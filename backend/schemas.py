"""Pydantic v2 schemas. Kept separate from DB models."""
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

TransactionType = Literal["income", "expense"]


class TransactionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    amount: float = Field(..., gt=0)
    category: str = Field(..., min_length=1, max_length=80)
    type: TransactionType
    currency: Optional[str] = Field(default=None, max_length=8)

    @field_validator("name", "category")
    @classmethod
    def strip(cls, v: str) -> str:
        return v.strip()


class TransactionResponse(BaseModel):
    id: int
    name: str
    amount: float
    category: str
    type: TransactionType
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