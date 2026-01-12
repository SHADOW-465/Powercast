"""
Powercast AI - Configuration Settings
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""
    
    # API
    api_title: str = "Powercast AI"
    api_version: str = "1.0.0"
    debug: bool = True
    
    # CORS
    cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Database (placeholder for future)
    database_url: str = "postgresql://localhost:5432/powercast"
    
    # Redis (placeholder for future)
    redis_url: str = "redis://localhost:6379"
    
    # ML Model
    model_path: str = "./ml/outputs/final_model.ckpt"
    conformal_path: str = "./ml/outputs/conformal_predictor.pkl"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
