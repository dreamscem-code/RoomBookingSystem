import os
from typing import Optional
from dotenv import load_dotenv
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Room Booking System"
    API_V1_STR: str = "/api/v1"

    # MongoDB Settings
    MONGO_URI: str = Field(
        default="mongodb://localhost:27017",
        validation_alias=AliasChoices("MONGO_URI"),
    )
    DB_NAME: str = "RoomBookingDB"

    # Security & JWT
    JWT_SECRET_KEY: str = "super_secret_jwt_key_change_in_production_environment"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Email / SMTP Settings
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_TLS: bool = True
    EMAILS_FROM_EMAIL: str = "noreply@roombooking.com"
    EMAILS_FROM_NAME: str = "Room Booking System"


settings = Settings() #helps to use the congif files for security keys when use settings.jwt_secret_keys and all other algorithms


