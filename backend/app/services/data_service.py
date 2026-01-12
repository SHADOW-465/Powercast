"""
Powercast AI - Data Service
Singleton service for data access
"""
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import numpy as np

# Add data generators path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from data.generators.mock_data import DataService


class DataServiceSingleton:
    """
    Singleton wrapper for data service
    """
    _instance: Optional[DataService] = None
    _forecast_cache: Dict = {}
    _last_update: Optional[datetime] = None
    
    @classmethod
    def initialize(cls, seed: int = 42):
        if cls._instance is None:
            cls._instance = DataService(seed)
    
    @classmethod
    def get_instance(cls) -> DataService:
        if cls._instance is None:
            cls.initialize()
        return cls._instance
    
    @classmethod
    def get_current_state(cls) -> Dict:
        """Get current grid state"""
        return cls.get_instance().get_current_state()
    
    @classmethod
    def get_forecast(cls, target: str = 'load', horizon_hours: int = 24) -> Dict:
        """
        Generate forecast data
        Returns point forecast + uncertainty intervals
        """
        now = datetime.now()
        intervals = horizon_hours * 4  # 15-min intervals
        
        # Get current state for base values
        state = cls.get_current_state()
        base_load = state['scada']['total_load_mw']
        base_solar = state['scada']['solar_generation_mw']
        base_wind = state['scada']['wind_generation_mw']
        
        forecasts = []
        
        for i in range(intervals):
            future_time = now + timedelta(minutes=15 * i)
            hour = future_time.hour + future_time.minute / 60
            
            # Generate realistic forecast patterns
            if target == 'load':
                # Load follows daily pattern with some noise
                daily_factor = cls._load_pattern(hour)
                point = base_load * daily_factor * (1 + np.random.normal(0, 0.02))
                std = 150 + i * 5  # Uncertainty grows with horizon
            elif target == 'solar':
                point = cls._solar_pattern(hour, future_time.month) * 5000
                std = 50 + i * 3
            elif target == 'wind':
                point = base_wind * (1 + np.random.normal(0, 0.15))
                std = 30 + i * 2
            else:  # net_load
                load_point = base_load * cls._load_pattern(hour)
                renewable = cls._solar_pattern(hour, future_time.month) * 5000 + base_wind
                point = load_point - renewable
                std = 200 + i * 7
            
            # Calculate quantiles
            q10 = point - 1.28 * std
            q50 = point
            q90 = point + 1.28 * std
            
            # Confidence interval (95%)
            ci_lower = point - 1.96 * std
            ci_upper = point + 1.96 * std
            
            # Confidence score (decreases with horizon)
            confidence = max(0.5, 0.95 - (i / intervals) * 0.3)
            
            forecasts.append({
                'timestamp': future_time.isoformat(),
                'point': round(max(0, point), 1),
                'q10': round(max(0, q10), 1),
                'q50': round(max(0, q50), 1),
                'q90': round(max(0, q90), 1),
                'ci95_lower': round(max(0, ci_lower), 1),
                'ci95_upper': round(max(0, ci_upper), 1),
                'confidence': round(confidence, 2)
            })
        
        return {
            'target': target,
            'generated_at': now.isoformat(),
            'horizon_hours': horizon_hours,
            'time_step_minutes': 15,
            'forecasts': forecasts
        }
    
    @staticmethod
    def _load_pattern(hour: float) -> float:
        """Daily load pattern"""
        morning = np.exp(-((hour - 9.5) ** 2) / 8) * 0.25
        evening = np.exp(-((hour - 18.5) ** 2) / 6) * 0.35
        base = 0.8 + morning + evening
        if hour < 5:
            base *= 0.85
        return base
    
    @staticmethod
    def _solar_pattern(hour: float, month: int) -> float:
        """Solar generation pattern"""
        if hour < 6 or hour > 20:
            return 0
        
        # Peak at noon
        solar_curve = np.sin((hour - 6) * np.pi / 14)
        
        # Seasonal factor
        seasonal = {
            1: 0.3, 2: 0.4, 3: 0.6, 4: 0.75, 5: 0.85, 6: 1.0,
            7: 1.0, 8: 0.9, 9: 0.7, 10: 0.5, 11: 0.35, 12: 0.3
        }
        
        return solar_curve * seasonal.get(month, 0.5)
    
    @classmethod
    def get_scenarios(cls, n_scenarios: int = 1000) -> Dict:
        """
        Generate Monte Carlo scenarios for optimization
        """
        now = datetime.now()
        horizon = 96  # 24 hours
        
        # Generate scenario paths
        scenarios = []
        
        state = cls.get_current_state()
        base_load = state['scada']['total_load_mw']
        
        for s in range(n_scenarios):
            path = []
            current = base_load
            
            for t in range(horizon):
                hour = (now.hour + t * 0.25) % 24
                trend = cls._load_pattern(hour) * base_load
                noise = np.random.normal(0, 200)
                current = trend + noise
                path.append(round(max(0, current), 1))
            
            scenarios.append(path)
        
        scenarios_array = np.array(scenarios)
        
        # Calculate statistics
        percentiles = {
            'p10': np.percentile(scenarios_array, 10, axis=0).tolist(),
            'p50': np.percentile(scenarios_array, 50, axis=0).tolist(),
            'p90': np.percentile(scenarios_array, 90, axis=0).tolist()
        }
        
        return {
            'generated_at': now.isoformat(),
            'n_scenarios': n_scenarios,
            'horizon_intervals': horizon,
            'statistics': {
                'mean_load': round(float(np.mean(scenarios_array)), 1),
                'max_peak_load': round(float(np.max(scenarios_array)), 1),
                'min_load': round(float(np.min(scenarios_array)), 1)
            },
            'percentiles': percentiles,
            'sample_scenarios': scenarios[:5]  # First 5 for visualization
        }
