import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import close_db_connection, get_database, init_db_indexes
from app.routers import auth, booking, notification, room, user

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

# CORS middleware for Web Frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(room.router, prefix=settings.API_V1_STR)
app.include_router(booking.router, prefix=settings.API_V1_STR)
app.include_router(notification.router, prefix=settings.API_V1_STR)
app.include_router(user.router, prefix=settings.API_V1_STR)


@app.get("/")
def read_root():
    return {
        "message": f"Welcome to the {settings.PROJECT_NAME} API",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
