"""
Powercast AI - FastAPI Backend
Main application entry point
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import sys
import os
import logging

# Add parent paths
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.api import (
    forecast,
    grid,
    assets,
    scenarios,
    patterns,
    plants,
    data,
    optimization,
    learning,
)
from app.core.config import settings
from app.services.data_service import DataServiceSingleton
from app.services.ml_inference import get_ml_service
from app.services.external_apis import get_weather_service, get_grid_service

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info("=" * 50)
    logger.info("Starting Powercast AI Backend...")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Debug mode: {settings.debug}")

    # Initialize services
    DataServiceSingleton.initialize()
    ml_service = get_ml_service()
    health = ml_service.health_check()

    logger.info(f"Data service initialized")
    logger.info(
        f"ML Service: {health['status']} (Model loaded: {health['model_loaded']})"
    )

    # Check external API availability
    weather_service = get_weather_service()
    grid_service = get_grid_service()

    logger.info(
        f"Weather API: {'REAL (OpenWeather)' if weather_service.use_real_api else 'SIMULATED'}"
    )
    logger.info(
        f"Grid API: {'REAL (ENTSO-E)' if grid_service.use_real_api else 'SIMULATED'}"
    )

    # Check Supabase
    from app.core.supabase import get_supabase

    supabase = get_supabase()
    logger.info(f"Database: {'SUPABASE' if supabase else 'IN-MEMORY MOCK'}")

    logger.info("=" * 50)
    logger.info("Powercast AI Backend ready!")

    yield

    # Shutdown
    logger.info("Shutting down Powercast AI Backend...")


app = FastAPI(
    title=settings.api_title,
    description="Intelligent Grid Forecasting & Optimization Platform",
    version=settings.api_version,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)


# Error handling middleware
@app.middleware("http")
async def error_handling_middleware(request: Request, call_next):
    """Global error handling"""
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.exception(f"Unhandled error: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal server error",
                "detail": str(e) if settings.debug else "An unexpected error occurred",
            },
        )


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins if not settings.debug else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================
# API Routers
# =========================================

# Existing routers
app.include_router(forecast.router, prefix="/api/v1/forecast", tags=["Forecast"])
app.include_router(grid.router, prefix="/api/v1/grid", tags=["Grid Status"])
app.include_router(assets.router, prefix="/api/v1/assets", tags=["Assets"])
app.include_router(scenarios.router, prefix="/api/v1/scenarios", tags=["Scenarios"])
app.include_router(patterns.router, prefix="/api/v1/patterns", tags=["Patterns"])

# New routers for frontend
app.include_router(plants.router, prefix="/api/v1/plants", tags=["Plants"])
app.include_router(data.router, prefix="/api/v1/data", tags=["Data Upload"])
app.include_router(
    optimization.router, prefix="/api/v1/optimization", tags=["Optimization"]
)

# Closed-loop learning system
app.include_router(
    learning.router, prefix="/api/v1/learning", tags=["Learning System"]
)


# =========================================
# Root & Health Endpoints
# =========================================


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "status": "operational",
        "docs": "/docs" if settings.debug else None,
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    ml_service = get_ml_service()
    health_check = ml_service.health_check()

    # Check Supabase connection
    from app.core.supabase import get_supabase

    supabase = get_supabase()
    db_status = "connected" if supabase else "mock"

    return {
        "status": "healthy",
        "environment": settings.environment,
        "services": {
            "ml_service": health_check,
            "database": db_status,
            "weather_api": "real" if settings.use_real_weather_api else "simulated",
            "grid_api": "real" if settings.use_real_grid_api else "simulated",
        },
    }


@app.get("/api/v1/config")
async def get_public_config():
    """Get public configuration (safe for frontend)"""
    return {
        "api_version": settings.api_version,
        "features": {
            "weather_api": settings.use_real_weather_api,
            "grid_api": settings.use_real_grid_api,
            "supabase": settings.use_supabase,
        },
        "forecast": {
            "horizon": settings.forecast_horizon,
            "confidence_levels": settings.confidence_levels,
        },
    }


# =========================================
# Weather & Grid Endpoints
# =========================================


@app.get("/api/v1/weather/current")
async def get_current_weather(lat: float = 47.3769, lon: float = 8.5417):
    """Get current weather for a location (default: Zurich)"""
    service = get_weather_service()
    return await service.get_current_weather(lat, lon)


@app.get("/api/v1/weather/forecast")
async def get_weather_forecast(
    lat: float = 47.3769, lon: float = 8.5417, hours: int = 48
):
    """Get weather forecast for a location"""
    service = get_weather_service()
    return await service.get_weather_forecast(lat, lon, hours)


@app.get("/api/v1/grid/prices")
async def get_grid_prices(area: str = "CH", hours: int = 24):
    """Get day-ahead electricity prices"""
    service = get_grid_service()
    return await service.get_day_ahead_prices(area, hours)


@app.get("/api/v1/grid/load")
async def get_grid_load(area: str = "CH"):
    """Get current grid load"""
    service = get_grid_service()
    return await service.get_grid_load(area)


# =========================================
# Run Server
# =========================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
