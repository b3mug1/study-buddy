from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str | None = Field(default=None, validation_alias="DATABASE_URL")
    jwt_secret_key: str | None = Field(default=None, validation_alias="JWT_SECRET_KEY")
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    cors_origins: list[str] = ["http://localhost:1000", "http://127.0.0.1:1000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
