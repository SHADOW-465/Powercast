"""
Powercast AI - Training Data Pipeline
Loads and preprocesses data for LSTM training
"""
import torch
from torch.utils.data import Dataset, DataLoader
import numpy as np
import pandas as pd
from typing import Tuple, List, Optional, Dict
from datetime import datetime, timedelta
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from data.generators.mock_data import DataService


class PowercastDataset(Dataset):
    """
    PyTorch Dataset for time series forecasting
    """
    
    def __init__(
        self,
        data: pd.DataFrame,
        input_seq_len: int = 168,  # 7 days * 24 hours (hourly) or 168 steps
        output_horizon: int = 96,   # 24 hours * 4 (15-min intervals)
        target_col: str = 'total_load_mw',
        feature_cols: Optional[List[str]] = None,
        normalize: bool = True
    ):
        self.input_seq_len = input_seq_len
        self.output_horizon = output_horizon
        self.target_col = target_col
        self.normalize = normalize
        
        # Default feature columns
        if feature_cols is None:
            feature_cols = [
                'total_load_mw',
                'renewable_generation_mw',
                'solar_generation_mw',
                'wind_generation_mw',
                'hydro_generation_mw',
                'nuclear_generation_mw',
                'net_load_mw'
            ]
        
        self.feature_cols = feature_cols
        
        # Extract features and target
        self.features = data[feature_cols].values.astype(np.float32)
        self.target = data[target_col].values.astype(np.float32)
        
        # Add time features
        if 'timestamp' in data.columns:
            timestamps = pd.to_datetime(data['timestamp'])
            hour = timestamps.dt.hour.values / 24.0
            day_of_week = timestamps.dt.dayofweek.values / 7.0
            month = timestamps.dt.month.values / 12.0
            is_weekend = (timestamps.dt.dayofweek >= 5).astype(float).values
            
            time_features = np.stack([hour, day_of_week, month, is_weekend], axis=1)
            self.features = np.concatenate([self.features, time_features], axis=1)
        
        # Normalize
        if normalize:
            self.feature_means = np.mean(self.features, axis=0)
            self.feature_stds = np.std(self.features, axis=0) + 1e-8
            self.features = (self.features - self.feature_means) / self.feature_stds
            
            self.target_mean = np.mean(self.target)
            self.target_std = np.std(self.target) + 1e-8
            self.target = (self.target - self.target_mean) / self.target_std
        
        # Calculate valid indices
        self.valid_indices = list(range(
            input_seq_len,
            len(self.features) - output_horizon
        ))
    
    def __len__(self) -> int:
        return len(self.valid_indices)
    
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        actual_idx = self.valid_indices[idx]
        
        # Input sequence
        x = self.features[actual_idx - self.input_seq_len : actual_idx]
        
        # Target sequence
        y = self.target[actual_idx : actual_idx + self.output_horizon]
        
        return torch.from_numpy(x), torch.from_numpy(y)
    
    def denormalize_target(self, y: np.ndarray) -> np.ndarray:
        """Reverse normalization for predictions"""
        if self.normalize:
            return y * self.target_std + self.target_mean
        return y


class DataPipeline:
    """
    Complete data pipeline for training and inference
    """
    
    def __init__(
        self,
        input_seq_len: int = 168,
        output_horizon: int = 96,
        batch_size: int = 32,
        train_ratio: float = 0.7,
        val_ratio: float = 0.15,
        seed: int = 42
    ):
        self.input_seq_len = input_seq_len
        self.output_horizon = output_horizon
        self.batch_size = batch_size
        self.train_ratio = train_ratio
        self.val_ratio = val_ratio
        self.seed = seed
        
        self.data_service = DataService(seed)
        
    def generate_training_data(self, days: int = 365) -> pd.DataFrame:
        """
        Generate synthetic training data
        """
        print(f"Generating {days} days of training data...")
        return self.data_service.generate_historical_data(days=days, interval_minutes=15)
    
    def create_dataloaders(
        self,
        data: Optional[pd.DataFrame] = None,
        days: int = 365
    ) -> Tuple[DataLoader, DataLoader, DataLoader]:
        """
        Create train/val/test dataloaders
        """
        if data is None:
            data = self.generate_training_data(days)
        
        n = len(data)
        train_end = int(n * self.train_ratio)
        val_end = int(n * (self.train_ratio + self.val_ratio))
        
        train_data = data.iloc[:train_end]
        val_data = data.iloc[train_end:val_end]
        test_data = data.iloc[val_end:]
        
        print(f"Train samples: {len(train_data)}")
        print(f"Val samples: {len(val_data)}")
        print(f"Test samples: {len(test_data)}")
        
        train_dataset = PowercastDataset(
            train_data,
            input_seq_len=self.input_seq_len,
            output_horizon=self.output_horizon
        )
        
        val_dataset = PowercastDataset(
            val_data,
            input_seq_len=self.input_seq_len,
            output_horizon=self.output_horizon
        )
        
        test_dataset = PowercastDataset(
            test_data,
            input_seq_len=self.input_seq_len,
            output_horizon=self.output_horizon
        )
        
        train_loader = DataLoader(
            train_dataset,
            batch_size=self.batch_size,
            shuffle=True,
            num_workers=0,  # Windows compatibility
            pin_memory=True
        )
        
        val_loader = DataLoader(
            val_dataset,
            batch_size=self.batch_size,
            shuffle=False,
            num_workers=0
        )
        
        test_loader = DataLoader(
            test_dataset,
            batch_size=self.batch_size,
            shuffle=False,
            num_workers=0
        )
        
        return train_loader, val_loader, test_loader


def prepare_features(scada_data: Dict, weather_data: Dict) -> np.ndarray:
    """
    Prepare features for model inference from live data
    """
    features = [
        scada_data.get('total_load_mw', 0),
        scada_data.get('renewable_generation_mw', 0),
        scada_data.get('solar_generation_mw', 0),
        scada_data.get('wind_generation_mw', 0),
        scada_data.get('hydro_generation_mw', 0),
        scada_data.get('nuclear_generation_mw', 0),
        scada_data.get('net_load_mw', 0),
        weather_data.get('temperature_c', 15),
        weather_data.get('humidity_pct', 50),
        weather_data.get('cloud_cover', 0.5),
        weather_data.get('wind_speed_ms', 5),
        weather_data.get('irradiance_wm2', 500)
    ]
    
    return np.array(features, dtype=np.float32)


if __name__ == "__main__":
    # Test data pipeline
    pipeline = DataPipeline(batch_size=32)
    
    # Generate small sample for testing
    train_loader, val_loader, test_loader = pipeline.create_dataloaders(days=30)
    
    # Check batch shape
    for x, y in train_loader:
        print(f"Input shape: {x.shape}")
        print(f"Target shape: {y.shape}")
        break
