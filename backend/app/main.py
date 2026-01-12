"""
Powercast AI - FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import sys
import os

# Add parent paths
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.api import forecast, grid, assets, scenarios, patterns
from app.core.config import settings
from app.services.data_service import DataServiceSingleton


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    print("Starting Powercast AI Backend...")
    DataServiceSingleton.initialize()
    print("Data service initialized")
    yield
    # Shutdown
    print("Shutting down Powercast AI Backend...")


app = FastAPI(
    title="Powercast AI",
    description="Intelligent Grid Forecasting & Optimization Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(forecast.router, prefix="/api/v1/forecast", tags=["Forecast"])
app.include_router(grid.router, prefix="/api/v1/grid", tags=["Grid Status"])
app.include_router(assets.router, prefix="/api/v1/assets", tags=["Assets"])
app.include_router(scenarios.router, prefix="/api/v1/scenarios", tags=["Scenarios"])
app.include_router(patterns.router, prefix="/api/v1/patterns", tags=["Patterns"])


@app.get("/")
async def root():
    return {
        "name": "Powercast AI",
        "version": "1.0.0",
        "status": "operational"
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
