"""Finera backend - FastAPI application.

Refactored: SQLAlchemy 2.0 ORM, Pydantic v2 schemas, service layer,
structured logging, proper error handlers, async currency rates,
update check, CORS via env, version-compare for auto-updates.
"""
from __future__ import annotations
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
from services.currency import currency_service, CurrencyError
from services.updates import get_update_info, get_ota_manifest, serve_bundle_file

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

app = FastAPI(title="Finera API", version=settings.app_version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["*"],
    allow_credentials=bool(settings.cors_origins_list) and settings.cors_origins_list != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValidationError)
async def _pydantic_handler(_: Request, exc: ValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


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


def _delete_kv(db: Session, key: str) -> None:
    row = db.get(SettingKV, key)
    if row:
        db.delete(row)
        db.commit()


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
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d %H:%M:%S")
    actual_amount = payload.amount if payload.type == "income" else -payload.amount
    tx = Transaction(
        name=payload.name,
        amount=actual_amount,
        category=payload.category,
        type=payload.type,
        date=date_str,
        month=now.month,
        year=now.year,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return TransactionResponse(
        id=tx.id, name=tx.name, amount=tx.amount, category=tx.category,
        type=tx.type, date=tx.date, month=tx.month, year=tx.year,
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
            type=r.type, date=r.date, month=r.month, year=r.year,
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
    return {"success": True, "deleted": transaction_id}


@app.get("/summary", response_model=MonthSummary)
def get_summary(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=1970, le=9999),
    db: Session = Depends(get_db),
) -> MonthSummary:
    now = datetime.now()
    m = month or now.month
    y = year or now.year
    rows = db.query(Transaction.amount, Transaction.type).filter(
        Transaction.month == m, Transaction.year == y
    ).all()
    total_income = sum(r.amount for r in rows if r.amount > 0)
    total_expense = sum(abs(r.amount) for r in rows if r.amount < 0)
    balance = total_income - total_expense
    savings_rate = (balance / total_income * 100) if total_income > 0 else 0.0
    return MonthSummary(
        total_income=total_income,
        total_expense=total_expense,
        balance=balance,
        savings_rate=savings_rate,
        transaction_count=len(rows),
    )


@app.get("/categories", response_model=List[CategoryTotal])
def get_categories(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=1970, le=9999),
    db: Session = Depends(get_db),
) -> List[CategoryTotal]:
    now = datetime.now()
    m = month or now.month
    y = year or now.year
    rows = (
        db.query(Transaction.category, func.sum(func.abs(Transaction.amount)).label("total"))
        .filter(Transaction.month == m, Transaction.year == y, Transaction.amount < 0)
        .group_by(Transaction.category)
        .order_by(func.sum(func.abs(Transaction.amount)).desc())
        .all()
    )
    return [CategoryTotal(category=r.category, total=r.total) for r in rows]


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------
@app.get("/ai/insights", response_model=AIInsightsResponse)
def get_ai_insights(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=1970, le=9999),
    db: Session = Depends(get_db),
) -> AIInsightsResponse:
    now = datetime.now()
    m = month or now.month
    y = year or now.year
    api_key = get_api_key(db)
    ai = FinanceAI(api_key=api_key)

    rows = db.query(Transaction).filter(Transaction.month == m, Transaction.year == y).all()
    rows_dicts = [
        {"id": r.id, "name": r.name, "amount": r.amount, "category": r.category,
         "type": r.type, "date": r.date, "month": r.month, "year": r.year}
        for r in rows
    ]
    cat_rows = (
        db.query(Transaction.category, func.sum(func.abs(Transaction.amount)).label("total"))
        .filter(Transaction.month == m, Transaction.year == y, Transaction.amount < 0)
        .group_by(Transaction.category)
        .all()
    )
    categories = {r.category: r.total for r in cat_rows}

    total_income = sum(r["amount"] for r in rows_dicts if r["amount"] > 0)
    total_expense = sum(abs(r["amount"]) for r in rows_dicts if r["amount"] < 0)

    previous_month = m - 1 if m > 1 else 12
    previous_year = y if m > 1 else y - 1
    prev_rows = db.query(Transaction).filter(
        Transaction.month == previous_month, Transaction.year == previous_year
    ).all()
    prev_income = sum(r.amount for r in prev_rows if r.amount > 0)
    prev_expense = sum(abs(r.amount) for r in prev_rows if r.amount < 0)

    result = ai.get_financial_insights(
        current_month_data={"income": total_income, "expense": total_expense, "categories": categories, "transactions": rows_dicts},
        previous_month_data={"income": prev_income, "expense": prev_expense},
        month=m, year=y,
    )
    top_category = max(categories.items(), key=lambda x: x[1])[0] if categories else "N/A"
    result.setdefault("highlights", {
        "income": total_income,
        "expenses": total_expense,
        "savings": total_income - total_expense,
        "top_category": top_category,
    })
    result["ai_configured"] = bool(api_key)
    if not api_key:
        result["model"] = ""
    else:
        result["model"] = ai.model
    return AIInsightsResponse(**result)


@app.get("/ai/suggestions", response_model=AISuggestionsResponse)
def get_ai_suggestions(db: Session = Depends(get_db)) -> AISuggestionsResponse:
    now = datetime.now()
    api_key = get_api_key(db)
    ai = FinanceAI(api_key=api_key)
    monthly_data = []
    for i in range(6):
        m = now.month - i
        y = now.year
        if m <= 0:
            m += 12
            y -= 1
        rows = db.query(Transaction).filter(Transaction.month == m, Transaction.year == y).all()
        income = sum(r.amount for r in rows if r.amount > 0)
        expense = sum(abs(r.amount) for r in rows if r.amount < 0)
        monthly_data.append({"month": m, "year": y, "income": income, "expense": expense})
    result = ai.get_savings_suggestions(monthly_data)
    result["ai_configured"] = bool(api_key)
    result["model"] = ai.model if api_key else ""
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
    amount: float = Query(..., gt=0),
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