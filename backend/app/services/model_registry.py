"""
Powercast AI - Model Registry Service
Multi-region XGBoost model management with lazy loading and LRU cache.

Features:
- Dynamic model loading per region_code
- Lazy loading: models loaded only when requested
- LRU cache eviction for memory efficiency
- Fallback to training pipeline if model not found
"""

import numpy as np
import joblib
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
from functools import lru_cache
from collections import OrderedDict
import logging
import threading

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

# Model artifacts base directory
_BASE_DIR = Path(__file__).parent.parent  # backend/app/
_MODELS_DIR = _BASE_DIR / "models"  # backend/app/models/
_ML_OUTPUTS_DIR = _BASE_DIR.parent.parent / "ml" / "outputs"  # ml/outputs/

# Maximum models to keep in memory
MAX_CACHED_MODELS = 5

# Region timezone mapping (Indian Grid + Swiss)
REGION_TIMEZONES: Dict[str, str] = {
    # Swiss Grid
    "SWISS_GRID": "Europe/Zurich",
    
    # Indian Grids
    "SOUTH_TN_TNEB": "Asia/Kolkata",
    "NORTH_UP_UPPCL": "Asia/Kolkata",
    "WEST_MH_MSEDCL": "Asia/Kolkata",
    "EAST_WB_WBSEDCL": "Asia/Kolkata",
    "SOUTH_KA_KPTCL": "Asia/Kolkata",
    "SOUTH_AP_APSPDCL": "Asia/Kolkata",
    "NORTH_RJ_RVUNL": "Asia/Kolkata",
    "WEST_GJ_GUVNL": "Asia/Kolkata",
    "SOUTH_KL_KSEB": "Asia/Kolkata",
    "NORTH_DL_DERC": "Asia/Kolkata",
    
    # Default
    "DEFAULT": "UTC",
}

# Peak hours by region (for feature engineering)
REGION_PEAK_HOURS: Dict[str, List[int]] = {
    "SWISS_GRID": [7, 8, 9, 10, 11, 12, 17, 18, 19, 20, 21],  # Swiss peaks
    "DEFAULT": [6, 7, 8, 9, 18, 19, 20, 21, 22],  # Indian evening peak
}


# =============================================================================
# MODEL METADATA
# =============================================================================

class ModelMetadata:
    """Metadata for a trained regional model"""
    
    def __init__(
        self,
        region_code: str,
        timezone: str,
        trained_at: Optional[datetime] = None,
        data_start: Optional[datetime] = None,
        data_end: Optional[datetime] = None,
        capacity_scale: Optional[float] = None,
        training_version: str = "1.0.0",
        artifact_path: Optional[str] = None,
        metrics: Optional[Dict[str, float]] = None
    ):
        self.region_code = region_code
        self.timezone = timezone
        self.trained_at = trained_at
        self.data_start = data_start
        self.data_end = data_end
        self.capacity_scale = capacity_scale
        self.training_version = training_version
        self.artifact_path = artifact_path
        self.metrics = metrics or {}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "region_code": self.region_code,
            "timezone": self.timezone,
            "trained_at": self.trained_at.isoformat() if self.trained_at else None,
            "data_start": self.data_start.isoformat() if self.data_start else None,
            "data_end": self.data_end.isoformat() if self.data_end else None,
            "capacity_scale": self.capacity_scale,
            "training_version": self.training_version,
            "artifact_path": self.artifact_path,
            "metrics": self.metrics,
        }
    
    @classmethod
    def from_config(cls, config: Dict[str, Any], region_code: str) -> "ModelMetadata":
        """Create metadata from training config JSON"""
        return cls(
            region_code=region_code,
            timezone=config.get("timezone", REGION_TIMEZONES.get(region_code, "UTC")),
            trained_at=datetime.fromisoformat(config["trained_at"]) if config.get("trained_at") else None,
            data_start=datetime.fromisoformat(config["data_start"]) if config.get("data_start") else None,
            data_end=datetime.fromisoformat(config["data_end"]) if config.get("data_end") else None,
            capacity_scale=config.get("capacity_scale"),
            training_version=config.get("training_version", "1.0.0"),
            metrics=config.get("metrics", {}),
        )


# =============================================================================
# MODEL REGISTRY
# =============================================================================

class ModelRegistry:
    """
    Multi-region XGBoost model registry with lazy loading.
    
    Features:
    - Lazy loading: models loaded only when requested
    - LRU cache: evicts least recently used models when limit reached
    - Thread-safe: uses locks for concurrent access
    - Fallback: returns training_required status if model not found
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        # LRU cache for loaded models
        self._model_cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._metadata_cache: Dict[str, ModelMetadata] = {}
        self._cache_lock = threading.Lock()
        
        # Scan available models on startup
        self._scan_available_models()
        
        self._initialized = True
        logger.info(f"ModelRegistry initialized. Found {len(self._metadata_cache)} models.")
    
    def _scan_available_models(self):
        """Scan model directories for available models"""
        # Check both locations
        for models_dir in [_MODELS_DIR, _ML_OUTPUTS_DIR]:
            if not models_dir.exists():
                continue
            
            # Look for region-specific models (format: xgboost_model_{region}.joblib)
            for model_file in models_dir.glob("xgboost_model_*.joblib"):
                region_code = model_file.stem.replace("xgboost_model_", "")
                config_path = models_dir / f"training_config_{region_code}.json"
                
                if config_path.exists():
                    with open(config_path) as f:
                        config = json.load(f)
                    self._metadata_cache[region_code] = ModelMetadata.from_config(config, region_code)
                    self._metadata_cache[region_code].artifact_path = str(model_file)
                else:
                    # Create default metadata
                    self._metadata_cache[region_code] = ModelMetadata(
                        region_code=region_code,
                        timezone=REGION_TIMEZONES.get(region_code, "UTC"),
                        artifact_path=str(model_file),
                    )
            
            # Also check for default model (backwards compatibility)
            default_model = models_dir / "xgboost_model.joblib"
            if default_model.exists() and "SWISS_GRID" not in self._metadata_cache:
                config_path = models_dir / "training_config.json"
                if config_path.exists():
                    with open(config_path) as f:
                        config = json.load(f)
                    self._metadata_cache["SWISS_GRID"] = ModelMetadata.from_config(config, "SWISS_GRID")
                    self._metadata_cache["SWISS_GRID"].artifact_path = str(default_model)
                else:
                    self._metadata_cache["SWISS_GRID"] = ModelMetadata(
                        region_code="SWISS_GRID",
                        timezone="Europe/Zurich",
                        artifact_path=str(default_model),
                    )
    
    def get_model(self, region_code: str) -> Optional[Dict[str, Any]]:
        """
        Get model for region. Lazy loads if not in cache.
        
        Returns None if model not found (triggers training_required).
        """
        with self._cache_lock:
            # Check if already loaded
            if region_code in self._model_cache:
                # Move to end (most recently used)
                self._model_cache.move_to_end(region_code)
                return self._model_cache[region_code]
        
        # Not in cache, try to load
        return self._load_model(region_code)
    
    def _load_model(self, region_code: str) -> Optional[Dict[str, Any]]:
        """Load model from disk into cache"""
        metadata = self._metadata_cache.get(region_code)
        
        if not metadata or not metadata.artifact_path:
            logger.warning(f"No model found for region: {region_code}")
            return None
        
        model_path = Path(metadata.artifact_path)
        if not model_path.exists():
            logger.error(f"Model file not found: {model_path}")
            return None
        
        try:
            logger.info(f"Loading model for region: {region_code}")
            model_data = joblib.load(model_path)
            
            with self._cache_lock:
                # Evict LRU if cache full
                while len(self._model_cache) >= MAX_CACHED_MODELS:
                    evicted = self._model_cache.popitem(last=False)
                    logger.info(f"Evicted model from cache: {evicted[0]}")
                
                # Add to cache
                self._model_cache[region_code] = model_data
            
            logger.info(f"Model loaded for region: {region_code}")
            return model_data
            
        except Exception as e:
            logger.error(f"Failed to load model for {region_code}: {e}")
            return None
    
    def get_metadata(self, region_code: str) -> Optional[ModelMetadata]:
        """Get metadata for a region's model"""
        return self._metadata_cache.get(region_code)
    
    def get_timezone(self, region_code: str) -> str:
        """Get timezone for a region"""
        metadata = self._metadata_cache.get(region_code)
        if metadata:
            return metadata.timezone
        return REGION_TIMEZONES.get(region_code, "UTC")
    
    def get_peak_hours(self, region_code: str) -> List[int]:
        """Get peak hours for a region"""
        if region_code == "SWISS_GRID":
            return REGION_PEAK_HOURS["SWISS_GRID"]
        return REGION_PEAK_HOURS["DEFAULT"]
    
    def is_model_available(self, region_code: str) -> bool:
        """Check if model is available for a region"""
        return region_code in self._metadata_cache
    
    def list_available_regions(self) -> List[str]:
        """List all regions with available models"""
        return list(self._metadata_cache.keys())
    
    def get_status(self, region_code: str) -> Dict[str, Any]:
        """Get status for a region's model"""
        metadata = self._metadata_cache.get(region_code)
        
        if not metadata:
            return {
                "status": "not_found",
                "region_code": region_code,
                "message": "No model found for this region. Training required.",
                "training_required": True,
            }
        
        is_loaded = region_code in self._model_cache
        
        return {
            "status": "loaded" if is_loaded else "available",
            "region_code": region_code,
            "timezone": metadata.timezone,
            "trained_at": metadata.trained_at.isoformat() if metadata.trained_at else None,
            "capacity_scale": metadata.capacity_scale,
            "metrics": metadata.metrics,
            "is_cached": is_loaded,
            "training_required": False,
        }
    
    def clear_cache(self, region_code: Optional[str] = None):
        """Clear model cache (for testing or memory management)"""
        with self._cache_lock:
            if region_code:
                self._model_cache.pop(region_code, None)
            else:
                self._model_cache.clear()
    
    def register_model(
        self,
        region_code: str,
        model_path: str,
        config: Dict[str, Any]
    ):
        """Register a newly trained model"""
        metadata = ModelMetadata.from_config(config, region_code)
        metadata.artifact_path = model_path
        
        with self._cache_lock:
            self._metadata_cache[region_code] = metadata
            # Clear from cache to force reload
            self._model_cache.pop(region_code, None)
        
        logger.info(f"Registered new model for region: {region_code}")


# =============================================================================
# GLOBAL REGISTRY INSTANCE
# =============================================================================

_registry = None

def get_model_registry() -> ModelRegistry:
    """Get or create model registry singleton"""
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry
