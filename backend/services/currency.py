"""Currency conversion service.

Uses open.er-api.com (free, no key) as primary source.
Falls back to Tavily web search if open.er-api fails and user has configured a key.
"""
from __future__ import annotations
import json
import logging
import re
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from config import settings
from db import CurrencyRateCache
from services.cache import TTLCache

log = logging.getLogger(__name__)

# Full currency code -> human name (Tavily understands these).
CURRENCY_NAMES = {
    "USD": "US Dollar", "EUR": "Euro", "GBP": "British Pound",
    "JPY": "Japanese Yen", "AUD": "Australian Dollar", "CAD": "Canadian Dollar",
    "CHF": "Swiss Franc", "NZD": "New Zealand Dollar", "SEK": "Swedish Krona",
    "NOK": "Norwegian Krone", "DKK": "Danish Krone", "INR": "Indian Rupee",
    "SGD": "Singapore Dollar", "HKD": "Hong Kong Dollar", "KRW": "South Korean Won",
    "CNY": "Chinese Yuan", "MYR": "Malaysian Ringgit", "THB": "Thai Baht",
    "IDR": "Indonesian Rupiah", "PHP": "Philippine Peso", "VND": "Vietnamese Dong",
    "AED": "UAE Dirham", "SAR": "Saudi Riyal", "TRY": "Turkish Lira",
    "ZAR": "South African Rand", "BRL": "Brazilian Real", "MXN": "Mexican Peso",
    "RUB": "Russian Ruble", "PLN": "Polish Zloty", "CZK": "Czech Koruna",
    "HUF": "Hungarian Forint", "ILS": "Israeli Shekel", "TWD": "Taiwan Dollar",
    "NGN": "Nigerian Naira",
}

SUPPORTED_BASES = set(CURRENCY_NAMES.keys())

PROVIDER_NAME = "tavily"
TAVILY_URL = "https://api.tavily.com/search"


class CurrencyError(Exception):
    """Raised when currency conversion cannot be performed."""


class CurrencyService:
    def __init__(self) -> None:
        self._cache: TTLCache[dict] = TTLCache()
        self._ttl = settings.currency_cache_ttl
        self._timeout = settings.currency_request_timeout

    def _resolve_key(self, db: Optional[Session]) -> str:
        # 1) DB (user-set via UI)
        if db is not None:
            try:
                row = db.execute(
                    text("SELECT value FROM settings_kv WHERE key='tavily_api_key'")
                ).fetchone()
                if row and row[0]:
                    return row[0]
            except Exception:
                pass
        # 2) Settings / env
        return settings.tavily_api_key or ""

    async def get_rates(self, base: str = "USD", db: Optional[Session] = None) -> dict:
        base = base.upper()
        if base not in SUPPORTED_BASES:
            raise ValueError(f"Unsupported base currency: {base}")

        cache_key = f"rates:{base}"
        cached = self._cache.get(cache_key)
        if cached:
            return cached

        # 1) Try open.er-api.com first (reliable real-time data, no API key required)
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.get(f"https://open.er-api.com/v6/latest/{base}")
                if r.status_code == 200:
                    data = r.json()
                    if data.get("result") == "success" and "rates" in data:
                        target_codes = [c for c in CURRENCY_NAMES.keys() if c != base]
                        filtered = {c: float(data["rates"][c]) for c in target_codes if c in data["rates"]}
                        if filtered:
                            rates = {
                                "base": base,
                                "rates": filtered,
                                "updated_at": datetime.fromtimestamp(data.get("time_last_update_unix", datetime.now().timestamp()), timezone.utc).isoformat(),
                                "next_update": None,
                                "provider": "exchangerate-api",
                            }
                            self._cache.set(cache_key, rates, self._ttl)
                            if db is not None:
                                self._persist_to_db(base, rates, db)
                            return rates
        except Exception as e:
            log.warning("Failed to fetch from open.er-api, trying Tavily fallback: %s", e)

        # 2) Fallback to Tavily
        api_key = self._resolve_key(db)
        if not api_key:
            raise CurrencyError(
                "Tavily API key not configured. Add it in Settings -> Tavily API key. "
                "Get a free key at https://tavily.com (1000 searches/month free)."
            )

        rates = await self._fetch_tavily(base, api_key)
        if not rates:
            raise CurrencyError(
                "Tavily returned no rates. Check your API key / network and try again."
            )

        self._cache.set(cache_key, rates, self._ttl)
        if db is not None:
            self._persist_to_db(base, rates, db)
        return rates

    async def convert(self, amount: float, from_currency: str, to_currency: str, db: Optional[Session] = None) -> dict:
        from_currency = from_currency.upper()
        to_currency = to_currency.upper()
        if from_currency == to_currency:
            return {
                "amount": amount, "from_currency": from_currency, "to_currency": to_currency,
                "converted": amount, "rate": 1.0, "updated_at": None,
            }
        rates = await self.get_rates(from_currency, db)
        rate = rates["rates"].get(to_currency)
        if rate is None:
            raise CurrencyError(f"Tavily did not return a rate for {to_currency}")
        return {
            "amount": amount, "from_currency": from_currency, "to_currency": to_currency,
            "converted": round(amount * rate, 6), "rate": rate,
            "updated_at": rates.get("updated_at"),
        }

    async def _fetch_tavily(self, base: str, api_key: str) -> Optional[dict]:
        # Ask Tavily for a JSON table of rates from `base` to all known currencies.
        target_codes = [c for c in CURRENCY_NAMES.keys() if c != base]
        names = [f"{c} ({CURRENCY_NAMES[c]})" for c in target_codes]

        prompt = (
            f"Find the current live exchange rate from 1 {base} ({CURRENCY_NAMES[base]}) "
            f"to each of these currencies today: {', '.join(names)}. "
            f"Return ONLY a single JSON object mapping currency codes (3-letter ISO) to numeric rates. "
            f"Use the most recent intraday or end-of-day rate from a reliable source "
            f"(xe.com, google.com/finance, oanda.com, ECB, etc.). "
            f'Example format: {{"INR": 92.34, "EUR": 0.91, "GBP": 0.78}}. '
            f"No commentary, no markdown, JSON only."
        )

        payload = {
            "api_key": api_key,
            "query": prompt,
            "search_depth": "advanced",
            "include_answer": True,
            "max_results": 5,
            "topic": "finance",
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.post(TAVILY_URL, json=payload)
                if r.status_code == 401:
                    raise CurrencyError("Tavily rejected the API key (401). Check it in Settings.")
                if r.status_code == 432:
                    raise CurrencyError("Tavily quota exceeded. Wait or upgrade your plan.")
                r.raise_for_status()
                data = r.json()
        except CurrencyError:
            raise
        except Exception as e:
            log.error("Tavily request failed: %s", e)
            raise CurrencyError(f"Tavily request failed: {e}")

        # Try answer first, then fall back to scraping result contents.
        answer = (data.get("answer") or "").strip()
        rates = self._parse_json_rates(answer) if answer else {}

        if not rates and data.get("results"):
            for res in data["results"]:
                rates = self._parse_json_rates(res.get("content", "")) or self._parse_loose_rates(res.get("content", ""))
                if rates:
                    break

        if not rates:
            return None

        # Ensure all target codes present (skip if Tavily missed some).
        filtered = {c: float(rates[c]) for c in target_codes if c in rates}
        if not filtered:
            return None

        return {
            "base": base,
            "rates": filtered,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "next_update": None,
            "provider": PROVIDER_NAME,
        }

    @staticmethod
    def _parse_json_rates(text: str) -> dict:
        """Extract a JSON object from text. Handles ```json blocks."""
        if not text:
            return {}
        m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S | re.I)
        if m:
            text = m.group(1)
        # Find the first {...} block.
        m = re.search(r"\{[^{}]+\}", text, re.S)
        if not m:
            return {}
        try:
            obj = json.loads(m.group(0))
            return {str(k).upper(): float(v) for k, v in obj.items() if _is_number(v)}
        except Exception:
            return {}

    @staticmethod
    def _parse_loose_rates(text: str) -> dict:
        """Last-resort regex: '1 USD = 92.34 INR' style sentences."""
        if not text:
            return {}
        rates: dict[str, float] = {}
        for m in re.finditer(r"=\s*([\d.,]+)\s*([A-Z]{3})\b", text):
            try:
                rates[m.group(2)] = float(m.group(1).replace(",", ""))
            except Exception:
                pass
        return rates

    def _persist_to_db(self, base: str, rates: dict, db: Session) -> None:
        try:
            row = CurrencyRateCache(
                base=base,
                rates_json=json.dumps(rates["rates"]),
                provider=rates["provider"],
                fetched_at=rates.get("updated_at") or datetime.now(timezone.utc).isoformat(),
            )
            db.add(row)
            db.commit()
        except Exception as e:
            log.warning("DB rate cache persist failed: %s", e)
            db.rollback()


def _is_number(v) -> bool:
    try:
        float(v)
        return True
    except Exception:
        return False


currency_service = CurrencyService()
