"""Consistent base-currency totals for the optional legacy API."""
import math
from services.currency import currency_service, CurrencyError, SUPPORTED_BASES

async def totals(rows, currency, db):
    if currency not in SUPPORTED_BASES: raise ValueError('Unsupported currency')
    rates = {}
    if any(row.currency != currency for row in rows):
        rates = (await currency_service.get_rates(currency, db))["rates"]
    income = expense = 0.0
    categories = {}
    for row in rows:
        rate = 1.0 if row.currency == currency else rates.get(row.currency)
        if rate is None or not math.isfinite(rate) or rate <= 0:
            raise CurrencyError(f"Missing rate for {row.currency} to {currency}")
        amount = abs(row.amount) / rate
        if row.type == "income": income += amount
        else:
            expense += amount
            categories[row.category] = categories.get(row.category, 0) + amount
    return {"income": income, "expense": expense, "categories": categories, "currency": currency}
