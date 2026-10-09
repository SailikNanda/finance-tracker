"""Finera backend - FastAPI application.

Refactored: SQLAlchemy 2.0 ORM, Pydantic v2 schemas, service layer,
structured logging, proper error handlers, async currency rates,
update check, CORS via env, version-compare for auto-updates.
"""
from __future__ import annotations
import json
import hashlib
import math
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from security import require_owner
from finance import totals as financial_totals
from pydantic import ValidationError
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from ai_analytics import FinanceAI
from config import settings
from db import CurrencyRateCache, MonthSession, SettingKV, Transaction, get_db, init_db
from schemas import (
    AIInsightsResponse, AISuggestionsResponse, ApiKeyRequest, ApiKeyStatus,
    CategoryTotal, CurrencyConvertRequest, CurrencyConvertResponse, CurrencyRates,
    HealthResponse, MonthSummary, TransactionCreate, TransactionResponse, UpdateInfo,
)
from services.cache import TTLCache
from services.currency import currency_service, CurrencyError
from services.updates import get_update_info, get_ota_manifest, serve_bundle_file

# AI response cache (1 hour TTL) - prevents repeated Groq calls for same month
ai_cache: TTLCache[dict] = TTLCache()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("finera")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app):
    init_db()
    log.info("Finera API v%s started", settings.app_version)
    yield

app = FastAPI(title="Finera legacy API", version=settings.app_version, lifespan=lifespan, dependencies=[Depends(require_owner)])

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=bool(settings.cors_origins_list) and settings.cors_origins_list != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValidationError)
@app.exception_handler(RequestValidationError)
async def _pydantic_handler(_: Request, exc) -> JSONResponse:
    # Error inputs can include float infinity or ValueError objects.
    # Do not echo submitted payloads (which may contain credentials).
    errors = [{"loc": list(error["loc"]), "type": error["type"], "msg": error["msg"]} for error in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})


@app.exception_handler(ValueError)
async def _value_error_handler(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(CurrencyError)
async def _currency_error_handler(_: Request, exc: CurrencyError) -> JSONResponse:
    log.warning("Currency error: %s", exc)
    return JSONResponse(status_code=503, content={"detail": str(exc), "code": "currency_error"})


@app.exception_handler(Exception)
async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ---------------------------------------------------------------------------
# Settings helpers (DB-backed, dynamic - reflects UI changes without restart)
# ---------------------------------------------------------------------------
def _get_kv(db: Session, key: str) -> str:
    """Read a SettingKV value from DB. Returns '' if missing or DB down."""
    try:
        row = db.get(SettingKV, key)
        return row.value if row else ""
    except Exception as e:
        log.warning("Failed to read setting %s: %s", key, e)
        return ""


def _set_kv(db: Session, key: str, value: str) -> None:
    row = db.get(SettingKV, key)
    if row:
        row.value = value
        row.updated_at = datetime.utcnow().isoformat()
    else:
        db.add(SettingKV(key=key, value=value))
    db.commit()
    ai_cache.clear()


def _delete_kv(db: Session, key: str) -> None:
    row = db.get(SettingKV, key)
    if row:
        db.delete(row)
        db.commit()
        ai_cache.clear()


def get_api_key(db: Session | None = None) -> str:
    """Groq key: prefer DB (set via UI), fall back to env / .env."""
    if db is not None:
        k = _get_kv(db, "groq_api_key")
        if k:
            return k
    return settings.groq_api_key or os.getenv("GROQ_API_KEY", "")


def get_tavily_key(db: Session | None = None) -> str:
    """Tavily key: prefer DB (set via UI), fall back to env / .env."""
    if db is not None:
        k = _get_kv(db, "tavily_api_key")
        if k:
            return k
    return settings.tavily_api_key or os.getenv("TAVILY_API_KEY", "")


def mask_api_key(key: str) -> str:
    if not key or len(key) < 8:
        return ""
    return key[:4] + "*" * (len(key) - 8) + key[-4:]


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/", response_model=HealthResponse)
def root(db: Session = Depends(get_db)) -> HealthResponse:
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        log.error("DB health check failed: %s", e)
        db_status = "error"
    return HealthResponse(
        version=settings.app_version,
        database=db_status,
        ai_configured=bool(get_api_key(db)),
    )


# ---------------------------------------------------------------------------
# API key (Groq + Tavily, generic store)
# ---------------------------------------------------------------------------
@app.get("/settings/apikey", response_model=ApiKeyStatus)
def get_apikey_status(provider: str = Query("groq"), db: Session = Depends(get_db)) -> ApiKeyStatus:
    if provider == "tavily":
        key = get_tavily_key(db)
    else:
        key = get_api_key(db)
    return ApiKeyStatus(configured=bool(key), masked=mask_api_key(key) if key else "")


@app.post("/settings/apikey")
def set_apikey(request: ApiKeyRequest, provider: str = Query("groq"), db: Session = Depends(get_db)) -> dict:
    p = (provider or "groq").lower().strip()
    if p not in ("groq", "tavily"):
        raise HTTPException(status_code=400, detail=f"Unknown provider: {p}")
    _set_kv(db, f"{p}_api_key", request.api_key)
    return {"success": True, "message": f"{p} API key saved"}


@app.delete("/settings/apikey")
def delete_apikey(provider: str = Query("groq"), db: Session = Depends(get_db)) -> dict:
    p = (provider or "groq").lower().strip()
    if p not in ("groq", "tavily"):
        raise HTTPException(status_code=400, detail=f"Unknown provider: {p}")
    _delete_kv(db, f"{p}_api_key")
    return {"success": True, "message": f"{p} API key removed"}


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------
@app.post("/transactions", response_model=TransactionResponse, status_code=201)
def add_transaction(payload: TransactionCreate, db: Session = Depends(get_db)) -> TransactionResponse:
    now = payload.date or datetime.now().astimezone()
    date_str = now.isoformat()
    actual_amount = payload.amount if payload.type == "income" else -payload.amount
    tx = Transaction(
        name=payload.name,
        amount=actual_amount,
        category=payload.category,
        type=payload.type,
        currency=payload.currency,
        date=date_str,
        month=now.month,
        year=now.year,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    ai_cache.clear()
    return TransactionResponse(
        id=tx.id, name=tx.name, amount=tx.amount, category=tx.category,
        type=tx.type, currency=tx.currency, date=tx.date, month=tx.month, year=tx.year,
    )


@app.get("/transactions", response_model=List[TransactionResponse])
def get_transactions(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=1970, le=9999),
    db: Session = Depends(get_db),
) -> List[TransactionResponse]:
    now = datetime.now()
    m = month or now.month
    y = year or now.year
    rows = (
        db.query(Transaction)
        .filter(Transaction.month == m, Transaction.year == y)
        .order_by(Transaction.date.desc())
        .all()
    )
    return [
        TransactionResponse(
            id=r.id, name=r.name, amount=r.amount, category=r.category,
            type=r.type, currency=r.currency, date=r.date, month=r.month, year=r.year,
        )
        for r in rows
    ]


@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)) -> dict:
    tx = db.get(Transaction, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()
    ai_cache.clear()
    return {"success": True, "deleted": transaction_id}


@app.get("/summary", response_model=MonthSummary)
async def get_summary(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=1970, le=9999),
    currency: str = Query("INR", pattern="^[A-Z]{3}$"),
    db: Session = Depends(get_db),
) -> MonthSummary:
    now = datetime.now()
    rows = db.query(Transaction).filter(Transaction.month == (month or now.month), Transaction.year == (year or now.year)).all()
    totals = await financial_totals(rows, currency, db)
    income, expense = totals["income"], totals["expense"]
    balance = income - expense
    return MonthSummary(total_income=income, total_expense=expense, balance=balance, savings_rate=balance / income * 100 if income else 0, transaction_count=len(rows))


@app.get("/categories", response_model=List[CategoryTotal])
async def get_categories(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=1970, le=9999),
    currency: str = Query("INR", pattern="^[A-Z]{3}$"),
    db: Session = Depends(get_db),
) -> List[CategoryTotal]:
    now = datetime.now()
    rows = db.query(Transaction).filter(Transaction.month == (month or now.month), Transaction.year == (year or now.year)).all()
    data = await financial_totals(rows, currency, db)
    return [CategoryTotal(category=category, total=amount) for category, amount in sorted(data["categories"].items(), key=lambda item: item[1], reverse=True)]


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------
def ai_cache_key(kind, key, data):
    key_id = hashlib.sha256(key.encode()).hexdigest()
    fingerprint = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    return f"{kind}:{key_id}:{fingerprint}"


@app.get("/ai/insights", response_model=AIInsightsResponse)
async def get_ai_insights(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=1970, le=9999),
    currency: str = Query("INR", pattern="^[A-Z]{3}$"),
    force: bool = False,
    db: Session = Depends(get_db),
) -> AIInsightsResponse:
    import asyncio
    now = datetime.now()
    m, y = month or now.month, year or now.year
    pm, py = (m - 1, y) if m > 1 else (12, y - 1)
    rows = db.query(Transaction).filter(Transaction.month == m, Transaction.year == y).all()
    previous = db.query(Transaction).filter(Transaction.month == pm, Transaction.year == py).all()
    current = await financial_totals(rows, currency, db)
    prev = await financial_totals(previous, currency, db)
    key = get_api_key(db)
    cache_key = ai_cache_key("insights", key, [m, y, current, prev])
    cached = ai_cache.get(cache_key)
    if cached and not force: return AIInsightsResponse(**cached)
    ai = FinanceAI(api_key=key)
    result = await asyncio.to_thread(ai.get_financial_insights, current, prev, m, y)
    live = bool(key) and ai.last_call_live
    result.update(ai_configured=live, model=ai.model if live else "", provider="groq" if live else "built-in")
    if live: ai_cache.set(cache_key, result, 3600)
    return AIInsightsResponse(**result)


@app.get("/ai/suggestions", response_model=AISuggestionsResponse)
async def get_ai_suggestions(currency: str = Query("INR", pattern="^[A-Z]{3}$"), force: bool = False, db: Session = Depends(get_db)) -> AISuggestionsResponse:
    import asyncio
    from sqlalchemy import and_, or_
    now = datetime.now()
    keys = [((now.month - index - 1) % 12 + 1, now.year + (now.month - index - 1) // 12) for index in range(6)]
    rows = db.query(Transaction).filter(or_(*[and_(Transaction.month == m, Transaction.year == y) for m, y in keys])).all()
    data = []
    for m, y in keys:
        value = await financial_totals([row for row in rows if row.month == m and row.year == y], currency, db)
        data.append({"month": m, "year": y, **value})
    key = get_api_key(db)
    cache_key = ai_cache_key("suggestions", key, data)
    cached = ai_cache.get(cache_key)
    if cached and not force: return AISuggestionsResponse(**cached)
    ai = FinanceAI(api_key=key)
    result = await asyncio.to_thread(ai.get_savings_suggestions, data)
    live = bool(key) and ai.last_call_live
    result.update(ai_configured=live, model=ai.model if live else "", provider="groq" if live else "built-in")
    if live: ai_cache.set(cache_key, result, 3600)
    return AISuggestionsResponse(**result)


# ---------------------------------------------------------------------------
# Currency
# ---------------------------------------------------------------------------
@app.get("/currency/rates", response_model=CurrencyRates)
async def currency_rates(
    base: str = Query("USD", min_length=3, max_length=3),
    db: Session = Depends(get_db),
) -> CurrencyRates:
    data = await currency_service.get_rates(base, db)
    return CurrencyRates(**data)


@app.get("/currency/convert", response_model=CurrencyConvertResponse)
async def currency_convert(
    amount: float = Query(..., gt=0, le=1e12, allow_inf_nan=False),
    from_currency: str = Query(..., alias="from", min_length=3, max_length=3),
    to_currency: str = Query(..., alias="to", min_length=3, max_length=3),
    db: Session = Depends(get_db),
) -> CurrencyConvertResponse:
    result = await currency_service.convert(amount, from_currency, to_currency, db)
    return CurrencyConvertResponse(**result)


@app.post("/currency/convert", response_model=CurrencyConvertResponse)
async def currency_convert_post(
    payload: CurrencyConvertRequest,
    db: Session = Depends(get_db),
) -> CurrencyConvertResponse:
    result = await currency_service.convert(payload.amount, payload.from_currency, payload.to_currency, db)
    return CurrencyConvertResponse(**result)


# ---------------------------------------------------------------------------
# Updates
# ---------------------------------------------------------------------------
@app.get("/updates/latest", response_model=UpdateInfo)
def updates_latest(current: str = Query(..., description="App version currently running")) -> UpdateInfo:
    return UpdateInfo(**get_update_info(current))


@app.get("/updates/manifest")
def updates_manifest(current: str = Query(..., description="App version currently running")) -> dict:
    return get_ota_manifest(current)


@app.get("/updates/bundle/{filename}")
def updates_bundle(filename: str):
    return serve_bundle_file(filename)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
    )
