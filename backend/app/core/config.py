"""
Powercast AI - Configuration Settings
Environment-based configuration with fallbacks for development
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with environment variable fallbacks"""

    # =========================================
    # API Configuration
    # =========================================
    api_title: str = "Powercast AI"
    api_version: str = "1.0.0"
    debug: bool = True
    environment: str = "development"  # development, staging, production

    # =========================================
    # CORS Configuration
    # =========================================
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://*.vercel.app",
    ]

    # =========================================
    # Supabase Configuration
    # =========================================
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""  # For server-side operations (bypasses RLS)

    @property
    def use_supabase(self) -> bool:
        """Check if Supabase is configured"""
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def use_supabase_admin(self) -> bool:
        """Check if Supabase admin/service role is configured"""
        return bool(self.supabase_url and self.supabase_service_role_key)

    # =========================================
    # External APIs (with fallback support)
    # =========================================

    # OpenWeather API
    openweather_api_key: str = ""
    openweather_base_url: str = "https://api.openweathermap.org/data/3.0"

    @property
    def use_real_weather_api(self) -> bool:
        """Check if real weather API is available"""
        return bool(self.openweather_api_key)

    # ENTSO-E (European Grid Data)
    entsoe_api_key: str = ""
    entsoe_base_url: str = "https://web-api.tp.entsoe.eu/api"

    @property
    def use_real_grid_api(self) -> bool:
        """Check if real grid API is available"""
        return bool(self.entsoe_api_key)

    # =========================================
    # ML Model Configuration
    # =========================================
    model_path: str = "./ml/outputs/xgboost_model.joblib"
    training_config_path: str = "./ml/outputs/training_config.json"
    conformal_path: str = "./ml/outputs/conformal_predictor.pkl"

    # Forecast settings
    forecast_horizon: int = 96  # 24 hours at 15-min intervals
    confidence_levels: List[float] = [0.1, 0.5, 0.9]  # Q10, Q50, Q90

    # =========================================
    # Rate Limiting
    # =========================================
    rate_limit_requests: int = 100
    rate_limit_period: int = 60  # seconds

    # =========================================
    # Logging
    # =========================================
    log_level: str = "INFO"
    log_format: str = "json"  # json or text

    # =========================================
    # Legacy/Future Configuration
    # =========================================
    database_url: str = ""  # Fallback if not using Supabase
    redis_url: str = ""  # For caching (optional)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()
