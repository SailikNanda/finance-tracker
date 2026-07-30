"""Application configuration loaded from environment / .env."""
from __future__ import annotations
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False
    log_level: str = "INFO"

    # CORS - comma separated. Use explicit origins in production.
    cors_origins: str = "*"

    # AI
    groq_api_key: str = ""
    tavily_api_key: str = ""

    # Currency (all providers are free, no API key required)
    currency_cache_ttl: int = 3600
    currency_request_timeout: float = 10.0

    # Updates
    app_version: str = "1.3.0"
    apk_download_url: str = ""
    update_notes: str = ""
    update_force_below: str = "1.0.0"
    bundle_base_url: str = ""  # Public URL where /updates/manifest.json + bundles are hosted (e.g. https://api.yourserver.com)

    # Paths
    database_url: str = f"sqlite:///{(BASE_DIR / 'database' / 'finance.db').as_posix()}"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()