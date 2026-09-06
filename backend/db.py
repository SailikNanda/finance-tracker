"""SQLAlchemy 2.0 ORM models and engine setup."""
from __future__ import annotations
from datetime import datetime
from pathlib import Path
from sqlalchemy import (
    CheckConstraint, Index, Integer, String, Float, Text,
    create_engine, select, func,
)
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, Session, mapped_column, sessionmaker,
)

from config import settings


class Base(DeclarativeBase):
    pass


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("type IN ('income','expense')", name="ck_transactions_type"),
        Index("idx_transactions_date", "date"),
        Index("idx_transactions_month_year", "month", "year"),
        Index("idx_transactions_category", "category"),
        Index("idx_transactions_type", "type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    type: Mapped[str] = mapped_column(String(8), nullable=False)
    date: Mapped[str] = mapped_column(String(32), nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)


class MonthSession(Base):
    __tablename__ = "month_sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    total_income: Mapped[float] = mapped_column(Float, default=0)
    total_expense: Mapped[float] = mapped_column(Float, default=0)
    balance: Mapped[float] = mapped_column(Float, default=0)
    is_closed: Mapped[int] = mapped_column(Integer, default=0)
    closed_at: Mapped[str | None] = mapped_column(Text, nullable=True)


class SettingKV(Base):
    __tablename__ = "settings_kv"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(
        Text, default=lambda: datetime.utcnow().isoformat()
    )


class CurrencyRateCache(Base):
    """Cached currency rates from external providers."""
    __tablename__ = "currency_rates_cache"
    __table_args__ = (
        Index("idx_rates_base", "base"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    base: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    rates_json: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(String(64), default="unknown")
    fetched_at: Mapped[str] = mapped_column(
        Text, default=lambda: datetime.utcnow().isoformat()
    )


# Engine + session
Path(settings.database_url.replace("sqlite:///", "")).parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(
    settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    pool_pre_ping=True,
)
# Enable WAL for better concurrent read/write performance on SQLite
if settings.database_url.startswith("sqlite"):
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA synchronous=NORMAL;")
            cursor.execute("PRAGMA cache_size=-64000;")  # 64MB cache
            cursor.execute("PRAGMA temp_store=MEMORY;")
        finally:
            cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def cleanup_old_rates(db: Session, keep_per_base: int = 20) -> None:
    """Keep only the newest N rate rows per base to prevent unbounded growth."""
    try:
        from sqlalchemy import text
        db.execute(text("""
            DELETE FROM currency_rates_cache WHERE id NOT IN (
                SELECT id FROM currency_rates_cache c2
                WHERE c2.base = currency_rates_cache.base
                ORDER BY fetched_at DESC LIMIT :keep
            )
        """), {"keep": keep_per_base})
        # Fallback: if above syntax fails on older SQLite, just prune by age (7 days)
        db.commit()
    except Exception:
        try:
            db.rollback()
            db.execute(text("DELETE FROM currency_rates_cache WHERE fetched_at < datetime('now', '-7 days')"))
            db.commit()
        except Exception:
            db.rollback()


def init_db() -> None:
    """Create all tables. Idempotent. For real migrations use Alembic."""
    Base.metadata.create_all(engine)


def get_db():
    """FastAPI dependency."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
