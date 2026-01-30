"""
Powercast AI - XGBoost Training Script (Google Colab)
Multi-Horizon Forecasting with Region-Aware Feature Engineering

SETUP: Run this cell first in Google Colab to install dependencies
"""

# =============================================================================
# INSTALLATION (Run this cell first in Colab)
# =============================================================================
"""
!pip install -q xgboost==2.0.3 pandas numpy scikit-learn joblib
"""

"""
Powercast AI - XGBoost Training Script (Google Colab)
Multi-Horizon Forecasting with Region-Aware Feature Engineering

This script trains 96 XGBoost models (one per 15-minute forecast interval)
for regional power grid load forecasting with timezone-aware features.

Architecture:
- 96 independent XGBoost models (h=1 to h=96)
- Conformal prediction for uncertainty quantification
- Region-specific timezone alignment
- Compatible with model_registry backend

Usage in Colab:
1. Upload CSV with columns: timestamp, output_mw, region_code
2. Run all cells
3. Download trained model files
4. Upload to backend/app/models/ directory
"""

import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

# Try to import Google Colab utilities
try:
    from google.colab import files
    IN_COLAB = True
    print("✓ Running in Google Colab")
except ImportError:
    IN_COLAB = False
    print("✓ Running in local environment")

# =============================================================================
# CONFIGURATION
# =============================================================================

# Region timezone mapping (matches backend)
REGION_TIMEZONES = {
    "SWISS_GRID": "Europe/Zurich",
    "SOUTH_TN_TNEB": "Asia/Kolkata",
    "NORTH_UP_UPPCL": "Asia/Kolkata",
    "WEST_MH_MSEDCL": "Asia/Kolkata",
    "EAST_WB_WBSEDCL": "Asia/Kolkata",
    "DEFAULT": "UTC",
}

# Region peak hours (matches backend)
REGION_PEAK_HOURS = {
    "SWISS_GRID": [7, 8, 9, 10, 11, 12, 17, 18, 19, 20, 21],
    "DEFAULT": [6, 7, 8, 9, 18, 19, 20, 21, 22],  # Indian evening peak
}

# Training parameters
FORECAST_HORIZON = 96  # 24 hours at 15-minute intervals
LOOKBACK_HOURS = 168  # 1 week
TRAIN_TEST_SPLIT = 0.8
CONFORMAL_ALPHA = 0.1  # 90% confidence intervals

# XGBoost hyperparameters
XGBOOST_PARAMS = {
    'max_depth': 6,
    'learning_rate': 0.05,
    'n_estimators': 200,
    'min_child_weight': 3,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'gamma': 0.1,
    'reg_alpha': 0.01,
    'reg_lambda': 1.0,
    'objective': 'reg:squarederror',
    'tree_method': 'hist',
    'random_state': 42,
}


# =============================================================================
# DATA LOADING AND PREPROCESSING
# =============================================================================

def upload_csv():
    """Upload CSV file in Colab"""
    if IN_COLAB:
        print("\n📂 Please upload your CSV file:")
        uploaded = files.upload()
        filename = list(uploaded.keys())[0]
        print(f"✓ Uploaded: {filename}")
        return filename
    else:
        # For local testing
        return "tneb_tamilnadu_load_6months_15min.csv"


def load_and_validate_data(filepath: str) -> pd.DataFrame:
    """Load CSV and validate required columns"""
    print("\n📊 Loading data...")
    
    df = pd.read_csv(filepath)
    print(f"  - Loaded {len(df):,} rows")
    
    # Check required columns
    required = ['timestamp', 'output_mw']
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")
    
    # Parse timestamps
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    
    # Detect region code
    if 'region_code' in df.columns:
        region_code = df['region_code'].iloc[0]
    else:
        region_code = "UNKNOWN"
        df['region_code'] = region_code
        print("  ⚠ No region_code column found, using 'UNKNOWN'")
    
    print(f"  - Region: {region_code}")
    print(f"  - Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
    print(f"  - Mean load: {df['output_mw'].mean():.1f} MW")
    print(f"  - Max load: {df['output_mw'].max():.1f} MW")
    
    return df


def create_timezone_aware_features(
    df: pd.DataFrame,
    region_code: str,
    lookback_steps: int = 672  # 1 week at 15-min intervals
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create features with timezone-aware calendar encoding.
    
    Features (21 total):
    - Lags: 1h, 6h, 24h, 168h (4 features)
    - Rolling stats: mean/std 24h, mean/std 168h (4 features)
    - Calendar: hour_sin/cos, dow_sin/cos, month_sin/cos (6 features)
    - Flags: is_weekend, is_peak_hour (2 features)
    - Weather placeholders: temp, humidity, cloud, wind, temp*humidity (5 features)
    """
    print("\n🔧 Engineering features...")
    
    # Get timezone and peak hours for region
    timezone = REGION_TIMEZONES.get(region_code, "UTC")
    peak_hours = REGION_PEAK_HOURS.get(
        region_code if region_code == "SWISS_GRID" else "DEFAULT"
    )
    
    print(f"  - Timezone: {timezone}")
    print(f"  - Peak hours: {peak_hours}")
    
    # Convert to local timezone
    df = df.copy()
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Check if timestamps are already timezone-aware
    if df['timestamp'].dt.tz is None:
        # Naive timestamps - localize first
        df['timestamp'] = df['timestamp'].dt.tz_localize('UTC').dt.tz_convert(timezone)
    else:
        # Already timezone-aware - just convert
        df['timestamp'] = df['timestamp'].dt.tz_convert(timezone)

    
    features_list = []
    targets_list = []
    
    for i in range(lookback_steps, len(df) - FORECAST_HORIZON):
        # Historical load values
        history = df['output_mw'].iloc[i - lookback_steps:i].values
        
        # Lag features
        lag_1h = history[-4]      # 1 hour ago
        lag_6h = history[-24]     # 6 hours ago
        lag_24h = history[-96]    # 24 hours ago
        lag_168h = history[-672]  # 1 week ago
        
        # Rolling statistics
        w24 = history[-96:]      # Last 24 hours
        w168 = history[-672:]    # Last 7 days
        
        mean_24h = w24.mean()
        std_24h = w24.std()
        mean_168h = w168.mean()
        std_168h = w168.std()
        
        # Calendar features (TIMEZONE-AWARE)
        ts = df['timestamp'].iloc[i]
        hour = ts.hour + ts.minute / 60
        day_of_week = ts.weekday()
        month = ts.month
        
        hour_sin = np.sin(2 * np.pi * hour / 24)
        hour_cos = np.cos(2 * np.pi * hour / 24)
        dow_sin = np.sin(2 * np.pi * day_of_week / 7)
        dow_cos = np.cos(2 * np.pi * day_of_week / 7)
        month_sin = np.sin(2 * np.pi * month / 12)
        month_cos = np.cos(2 * np.pi * month / 12)
        
        is_weekend = 1.0 if day_of_week >= 5 else 0.0
        is_peak = 1.0 if ts.hour in peak_hours else 0.0
        
        # Weather placeholders (to be replaced with real data)
        temp = 15.0
        humidity = 50.0
        cloud_cover = 30.0
        wind_speed = 5.0
        temp_humidity = temp * humidity / 100
        
        # Combine all features
        features = np.array([
            lag_1h, lag_6h, lag_24h, lag_168h,
            mean_24h, std_24h, mean_168h, std_168h,
            hour_sin, hour_cos, dow_sin, dow_cos, month_sin, month_cos,
            is_weekend, is_peak,
            temp, humidity, cloud_cover, wind_speed, temp_humidity
        ])
        
        # Target: next 96 values (24 hours)
        targets = df['output_mw'].iloc[i:i + FORECAST_HORIZON].values
        
        features_list.append(features)
        targets_list.append(targets)
    
    X = np.array(features_list)
    y = np.array(targets_list)
    
    print(f"  - Created {len(X):,} samples")
    print(f"  - Feature shape: {X.shape}")
    print(f"  - Target shape: {y.shape}")
    
    return X, y


# =============================================================================
# MODEL TRAINING
# =============================================================================

def train_multi_horizon_models(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_test: np.ndarray,
    y_test: np.ndarray
) -> Tuple[List[xgb.XGBRegressor], Dict[str, float]]:
    """
    Train 96 independent XGBoost models (one per forecast horizon).
    """
    print(f"\n🚀 Training {FORECAST_HORIZON} XGBoost models...")
    
    models = []
    horizon_errors = []
    
    for h in range(FORECAST_HORIZON):
        if (h + 1) % 20 == 0:
            print(f"  - Training horizon {h + 1}/{FORECAST_HORIZON}...")
        
        # Train model for this horizon
        model = xgb.XGBRegressor(**XGBOOST_PARAMS)
        model.fit(
            X_train,
            y_train[:, h],
            eval_set=[(X_test, y_test[:, h])],
            verbose=False
        )
        
        # Calculate error
        y_pred = model.predict(X_test)
        mape = np.mean(np.abs((y_test[:, h] - y_pred) / y_test[:, h])) * 100
        horizon_errors.append(mape)
        
        models.append(model)
    
    # Overall metrics
    test_preds = np.column_stack([m.predict(X_test) for m in models])
    
    test_mape = np.mean(np.abs((y_test - test_preds) / y_test)) * 100
    test_mae = np.mean(np.abs(y_test - test_preds))
    test_rmse = np.sqrt(np.mean((y_test - test_preds) ** 2))
    
    metrics = {
        'test_mape': float(test_mape),
        'test_mae': float(test_mae),
        'test_rmse': float(test_rmse),
        'horizon_mape': {f'h{i+1}': float(e) for i, e in enumerate(horizon_errors[:24])},  # First 24 horizons
    }
    
    print(f"\n✓ Training complete!")
    print(f"  - Test MAPE: {test_mape:.2f}%")
    print(f"  - Test MAE: {test_mae:.1f} MW")
    print(f"  - Test RMSE: {test_rmse:.1f} MW")
    
    return models, metrics


def calculate_conformal_margins(
    models: List[xgb.XGBRegressor],
    X_calib: np.ndarray,
    y_calib: np.ndarray,
    alphas: List[float] = [0.05, 0.1, 0.2]
) -> Dict[str, np.ndarray]:
    """
    Calculate conformal prediction margins for uncertainty quantification.
    """
    print("\n📊 Calculating conformal prediction intervals...")
    
    # Get predictions
    calib_preds = np.column_stack([m.predict(X_calib) for m in models])
    
    # Calculate absolute residuals
    residuals = np.abs(y_calib - calib_preds)
    
    # Calculate quantiles per horizon
    margins = {}
    for alpha in alphas:
        q = (1 - alpha) * 100
        margin = np.percentile(residuals, q, axis=0)
        margins[f'q{int(q)}'] = margin
        print(f"  - Q{int(q)}: mean margin = {margin.mean():.1f} MW")
    
    return margins


# =============================================================================
# MODEL SAVING
# =============================================================================

def save_model_artifacts(
    models: List[xgb.XGBRegressor],
    feature_means: np.ndarray,
    feature_stds: np.ndarray,
    conformal_margins: Dict[str, np.ndarray],
    metrics: Dict[str, float],
    region_code: str,
    data_start: datetime,
    data_end: datetime,
    capacity_scale: float
):
    """
    Save model artifacts in format compatible with model_registry.
    """
    print("\n💾 Saving model artifacts...")
    
    # Create output directory
    output_dir = Path("model_outputs")
    output_dir.mkdir(exist_ok=True)
    
    # Model data package
    model_data = {
        'models': models,
        'feature_means': feature_means,
        'feature_stds': feature_stds,
        'conformal_margins': conformal_margins,
    }
    
    # Save model
    model_filename = f"xgboost_model_{region_code}.joblib"
    model_path = output_dir / model_filename
    joblib.dump(model_data, model_path)
    print(f"  ✓ Saved: {model_filename}")
    
    # Training config (metadata for model_registry)
    config = {
        'region_code': region_code,
        'timezone': REGION_TIMEZONES.get(region_code, "UTC"),
        'trained_at': datetime.now().isoformat(),
        'data_start': data_start.isoformat(),
        'data_end': data_end.isoformat(),
        'capacity_scale': capacity_scale,
        'training_version': '1.0.0',
        'model_type': 'xgboost',
        'output_horizon': FORECAST_HORIZON,
        'n_features': 21,
        'metrics': metrics,
    }
    
    config_filename = f"training_config_{region_code}.json"
    config_path = output_dir / config_filename
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    print(f"  ✓ Saved: {config_filename}")
    
    return model_path, config_path


def download_model_files():
    """Download trained model files in Colab"""
    if IN_COLAB:
        print("\n📥 Downloading model files...")
        output_dir = Path("model_outputs")
        for file in output_dir.glob("*"):
            files.download(str(file))
            print(f"  ✓ Downloaded: {file.name}")
    else:
        print("\n✓ Model files saved to: model_outputs/")


# =============================================================================
# MAIN TRAINING PIPELINE
# =============================================================================

def main():
    """Main training pipeline"""
    print("=" * 70)
    print("POWERCAST AI - XGBoost Multi-Horizon Training")
    print("=" * 70)
    
    # Step 1: Upload and load data
    if IN_COLAB:
        csv_file = upload_csv()
    else:
        csv_file = input("Enter CSV filename: ")
    
    df = load_and_validate_data(csv_file)
    region_code = df['region_code'].iloc[0]
    
    # Step 2: Create features
    X, y = create_timezone_aware_features(df, region_code)
    
    # Step 3: Normalize features
    print("\n📏 Normalizing features...")
    feature_means = X.mean(axis=0)
    feature_stds = X.std(axis=0)
    X_norm = (X - feature_means) / feature_stds
    
    # Step 4: Train/test split
    split_idx = int(len(X_norm) * TRAIN_TEST_SPLIT)
    calib_idx = int(split_idx * 0.9)  # 90% of train for training, 10% for calibration
    
    X_train = X_norm[:calib_idx]
    y_train = y[:calib_idx]
    X_calib = X_norm[calib_idx:split_idx]
    y_calib = y[calib_idx:split_idx]
    X_test = X_norm[split_idx:]
    y_test = y[split_idx:]
    
    print(f"  - Train: {len(X_train):,} samples")
    print(f"  - Calibration: {len(X_calib):,} samples")
    print(f"  - Test: {len(X_test):,} samples")
    
    # Step 5: Train models
    models, metrics = train_multi_horizon_models(X_train, y_train, X_test, y_test)
    
    # Step 6: Conformal prediction
    conformal_margins = calculate_conformal_margins(models, X_calib, y_calib)
    
    # Step 7: Save artifacts
    capacity_scale = df['output_mw'].max()
    model_path, config_path = save_model_artifacts(
        models=models,
        feature_means=feature_means,
        feature_stds=feature_stds,
        conformal_margins=conformal_margins,
        metrics=metrics,
        region_code=region_code,
        data_start=df['timestamp'].min(),
        data_end=df['timestamp'].max(),
        capacity_scale=capacity_scale
    )
    
    # Step 8: Download files
    download_model_files()
    
    print("\n" + "=" * 70)
    print("✅ TRAINING COMPLETE!")
    print("=" * 70)
    print(f"\nNext steps:")
    print(f"1. Upload {model_path.name} to backend/app/models/")
    print(f"2. Upload {config_path.name} to backend/app/models/")
    print(f"3. Restart backend to load new model")
    print(f"4. Test with: GET /api/forecast?region_code={region_code}")


# =============================================================================
# EXECUTION
# =============================================================================

if __name__ == "__main__":
    main()
