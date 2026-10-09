"""Pydantic v2 schemas. Kept separate from DB models."""
from __future__ import annotations
from typing import Literal, Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict
from services.currency import SUPPORTED_BASES

TransactionType = Literal["income", "expense"]


class TransactionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)
    name: str = Field(..., min_length=1, max_length=200)
    amount: float = Field(..., gt=0, le=1e12)
    category: str = Field(..., min_length=1, max_length=80)
    type: TransactionType
    currency: str = Field(default="INR", min_length=3, max_length=3)
    date: datetime | None = None

    @field_validator("name", "category")
    @classmethod
    def strip(cls, v: str) -> str:
        value = v.strip()
        if not value: raise ValueError("Must not be blank")
        return value

    @field_validator("currency")
    @classmethod
    def currency_code(cls, value):
        code = value.strip().upper()
        if code not in SUPPORTED_BASES: raise ValueError("Unsupported currency")
        return code


class TransactionResponse(BaseModel):
    id: int
    name: str
    amount: float
    category: str
    type: TransactionType
    currency: str
    date: str
    month: int
    year: int


class MonthSummary(BaseModel):
    total_income: float
    total_expense: float
    balance: float
    savings_rate: float
    transaction_count: int


class CategoryTotal(BaseModel):
    category: str
    total: float


class ApiKeyRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    api_key: str = Field(..., min_length=10, max_length=500)


class ApiKeyStatus(BaseModel):
    configured: bool
    masked: str = ""


class CurrencyRates(BaseModel):
    base: str
    rates: dict[str, float]
    updated_at: Optional[str] = None
    provider: str
    next_update: Optional[str] = None


class CurrencyConvertRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    amount: float = Field(..., gt=0)
    from_currency: str = Field(..., min_length=3, max_length=3)
    to_currency: str = Field(..., min_length=3, max_length=3)

    @field_validator("from_currency", "to_currency")
    @classmethod
    def upper(cls, v: str) -> str:
        return v.upper().strip()


class CurrencyConvertResponse(BaseModel):
    amount: float
    from_currency: str
    to_currency: str
    converted: float
    rate: float
    updated_at: Optional[str] = None


class UpdateInfo(BaseModel):
    latest_version: str
    current_version: str
    update_available: bool
    force_update: bool
    url: str
    notes: str = ""


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    database: str
    ai_configured: bool


class AIInsightsResponse(BaseModel):
    month: str
    year: int
    insights: str
    highlights: dict
    ai_configured: bool
    provider: str = "groq"
    model: str = ""


class AISuggestionsResponse(BaseModel):
    suggestions: str
    analysis_period: str
    average_income: float
    average_expense: float
    ai_configured: bool
    provider: str = "groq"
    model: str = ""
