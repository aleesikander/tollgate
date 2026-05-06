"""Application configuration using pydantic-settings."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    database_url: str = "postgresql+asyncpg://tollgate:tollgate@localhost:5432/tollgate"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT Configuration
    jwt_secret: str = "your-super-secret-jwt-key-change-in-production"
    jwt_expiry_days: int = 7

    # API Key HMAC Secret (for fast API key verification)
    # Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
    api_key_hmac_secret: str = "your-api-key-hmac-secret-change-in-production"

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_format: Literal["json", "console"] = "json"

    # Slack Integration
    slack_client_id: str = ""
    slack_client_secret: str = ""
    slack_signing_secret: str = ""

    # Encryption key for storing sensitive data (Slack tokens)
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str = ""

    # Dashboard URL for OAuth redirects
    dashboard_url: str = "http://localhost:3000"

    # Public base URL for API (ngrok URL in dev, real domain in production)
    # Used for Slack OAuth callbacks and webhook URLs
    # No default - must be provided
    public_base_url: str

    # Resend email
    resend_api_key: str = ""
    resend_from_email: str = "Tollgate <noreply@usetollgate.com>"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
