import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Room Booking System"
    API_V1_STR: str = "/api/v1"

    # MongoDB Settings
    MONGO_URI: str = os.getenv("MONGO_URI") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
    DB_NAME: str = os.getenv("DB_NAME", "RoomBookingDB")

    # Security & JWT
    JWT_SECRET_KEY: str = "super_secret_jwt_key_change_in_production_environment"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours


settings = Settings()
