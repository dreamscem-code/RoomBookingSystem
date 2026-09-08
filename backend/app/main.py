import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.config import settings
from app.db import close_db_connection, get_database, init_db_indexes

logger = logging.getLogger("uvicorn")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to MongoDB and initialize indexes
    logger.info("Initializing database indexes...")
    try:
        db = get_database()
        init_db_indexes(db)
        logger.info("Database indexes created successfully.")
    except Exception as exc:
        logger.error(f"Error during database index initialization: {exc}")

    yield

    # Shutdown: Cleanly close MongoDB client connection
    logger.info("Closing database connection...")
    close_db_connection()
    logger.info("Database connection closed.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)


@app.get("/")
def read_root():
    return {
        "message": f"Welcome to the {settings.PROJECT_NAME} API",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
