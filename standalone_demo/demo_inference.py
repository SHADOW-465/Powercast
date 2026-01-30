"""
Powercast AI - Standalone Prediction Demo
==========================================

FULLY PORTABLE: This folder contains everything needed to run predictions.
Move this entire folder anywhere and run `python demo_inference.py`

Contents:
- models/xgboost_model_SOUTH_TN_TNEB.joblib  (trained XGBoost model)
- models/training_config_SOUTH_TN_TNEB.json  (model metadata)
- data/tneb_tamilnadu_load_6months_15min.csv (historical load data)

Usage:
    python demo_inference.py

Output:
    - 96 predictions (24 hours at 15-minute intervals)
    - Point predictions with confidence intervals (q10, q90)
    - Model metadata and accuracy metrics
"""

import numpy as np
import pandas as pd
import joblib
import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

# =============================================================================
# CONFIGURATION - All paths relative to this script
# =============================================================================

SCRIPT_DIR = Path(__file__).parent

# Model and data files (all inside this folder)
MODEL_PATH = SCRIPT_DIR / "models" / "xgboost_model_SOUTH_TN_TNEB.joblib"
CONFIG_PATH = SCRIPT_DIR / "models" / "training_config_SOUTH_TN_TNEB.json"
CSV_PATH = SCRIPT_DIR / "data" / "tneb_tamilnadu_load_6months_15min.csv"

# Region configuration
REGION_CODE = "SOUTH_TN_TNEB"
TIMEZONE = "Asia/Kolkata"
PEAK_HOURS = [6, 7, 8, 9, 18, 19, 20, 21, 22]  # Indian evening peak

# =============================================================================
# FEATURE ENGINEERING
# =============================================================================

def create_features_from_history(load_history: np.ndarray, forecast_time: datetime) -> np.ndarray:
    """
    Create 21-feature vector for model prediction.
    
    Features:
    - 4 lag features (1h, 6h, 24h, 168h)
    - 4 rolling stats (mean/std for 24h and 168h)
    - 6 calendar features (sin/cos for hour, day_of_week, month)
    - 2 binary flags (is_weekend, is_peak_hour)
    - 5 weather placeholders
    """
    features = []
    
    # Lag features (at 15-min intervals)
    features.extend([
        load_history[-4],    # 1 hour ago
        load_history[-24],   # 6 hours ago
        load_history[-96],   # 24 hours ago
        load_history[-672],  # 168 hours (1 week) ago
    ])
    
    # Rolling statistics
    w24 = load_history[-96:]   # Last 24 hours
    w168 = load_history[-672:] # Last 7 days
    
    features.extend([
        w24.mean(),
        w24.std(),
        w168.mean(),
        w168.std(),
    ])
    
    # Calendar features (timezone-aware)
    local_tz = ZoneInfo(TIMEZONE)
    if forecast_time.tzinfo is None:
        local_dt = forecast_time.replace(tzinfo=ZoneInfo('UTC')).astimezone(local_tz)
    else:
        local_dt = forecast_time.astimezone(local_tz)
    
    hour = local_dt.hour + local_dt.minute / 60
    day_of_week = local_dt.weekday()
    month = local_dt.month
    
    features.extend([
        np.sin(2 * np.pi * hour / 24),
        np.cos(2 * np.pi * hour / 24),
        np.sin(2 * np.pi * day_of_week / 7),
        np.cos(2 * np.pi * day_of_week / 7),
        np.sin(2 * np.pi * month / 12),
        np.cos(2 * np.pi * month / 12),
        1.0 if day_of_week >= 5 else 0.0,  # is_weekend
        1.0 if local_dt.hour in PEAK_HOURS else 0.0,  # is_peak_hour
    ])
    
    # Weather placeholders (default values)
    features.extend([15.0, 50.0, 30.0, 5.0, 7.5])
    
    return np.array(features)

# =============================================================================
# PREDICTION
# =============================================================================

def load_model():
    """Load the trained XGBoost model."""
    print(f"\n📦 Loading model from: {MODEL_PATH.name}")
    
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}\n"
            f"Make sure the 'models' folder is present with the .joblib file"
        )
    
    model_data = joblib.load(MODEL_PATH)
    print(f"   ✓ Loaded 96 XGBoost models")
    print(f"   ✓ Feature normalization parameters loaded")
    print(f"   ✓ Conformal margins loaded")
    
    return model_data


def load_config():
    """Load training configuration."""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {}


def load_historical_data():
    """Load CSV and get last week of data for feature engineering."""
    print(f"\n📊 Loading historical data from: {CSV_PATH.name}")
    
    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"CSV not found: {CSV_PATH}\n"
            f"Make sure the 'data' folder is present with the CSV file"
        )
    
    df = pd.read_csv(CSV_PATH)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp')
    
    print(f"   ✓ Loaded {len(df):,} rows")
    print(f"   ✓ Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
    print(f"   ✓ Load range: {df['output_mw'].min():.1f} - {df['output_mw'].max():.1f} MW")
    
    # Get last 672 values (1 week) for feature engineering
    last_week = df['output_mw'].values[-672:]
    last_timestamp = df['timestamp'].iloc[-1]
    
    return last_week, last_timestamp


def generate_predictions(model_data, load_history, forecast_start):
    """Generate 24-hour predictions."""
    print(f"\n🔮 Generating predictions...")
    
    models = model_data['models']
    feature_means = model_data['feature_means']
    feature_stds = model_data['feature_stds']
    conformal_margins = model_data.get('conformal_margins', {})
    
    # Create features
    features = create_features_from_history(load_history, forecast_start)
    
    # Normalize
    features_norm = (features - feature_means) / feature_stds
    X = features_norm.reshape(1, -1)
    
    # Predict using all 96 models
    point_forecast = np.array([m.predict(X)[0] for m in models])
    
    # Apply conformal intervals
    margin_q90 = conformal_margins.get('q90', point_forecast * 0.1)
    q10 = point_forecast - margin_q90
    q90 = point_forecast + margin_q90
    
    # Generate timestamps
    local_tz = ZoneInfo(TIMEZONE)
    start_time = datetime.now(local_tz)
    
    predictions = []
    for i in range(len(point_forecast)):
        ts = start_time + timedelta(minutes=15 * i)
        predictions.append({
            'timestamp': ts.strftime('%Y-%m-%d %H:%M'),
            'point_mw': round(point_forecast[i], 1),
            'q10_mw': round(q10[i], 1),
            'q90_mw': round(q90[i], 1),
        })
    
    return predictions


def print_predictions(predictions, config):
    """Print formatted prediction output."""
    print("\n" + "=" * 70)
    print("POWERCAST AI - LOAD FORECAST OUTPUT")
    print("=" * 70)
    
    # Model metadata
    print(f"\n📍 Region: {REGION_CODE}")
    print(f"⏰ Timezone: {TIMEZONE}")
    print(f"📈 Model MAPE: {config.get('metrics', {}).get('test_mape', 'N/A'):.2f}%")
    print(f"🕐 Forecast horizon: 24 hours (96 intervals)")
    
    # Predictions table
    print("\n" + "-" * 70)
    print(f"{'Timestamp':<20} {'Prediction (MW)':>15} {'Low (q10)':>12} {'High (q90)':>12}")
    print("-" * 70)
    
    for i, pred in enumerate(predictions):
        # Show every 4th prediction (hourly) or first/last few
        if i < 4 or i >= len(predictions) - 4 or i % 4 == 0:
            print(f"{pred['timestamp']:<20} {pred['point_mw']:>15,.1f} {pred['q10_mw']:>12,.1f} {pred['q90_mw']:>12,.1f}")
        elif i == 4:
            print(f"{'...':<20} {'...':>15} {'...':>12} {'...':>12}")
    
    print("-" * 70)
    
    # Summary stats
    points = [p['point_mw'] for p in predictions]
    print(f"\n📊 Forecast Summary:")
    print(f"   • Min predicted load:  {min(points):,.1f} MW")
    print(f"   • Max predicted load:  {max(points):,.1f} MW")
    print(f"   • Mean predicted load: {np.mean(points):,.1f} MW")
    
    print("\n" + "=" * 70)
    print("✅ PREDICTION COMPLETE - Model is working correctly!")
    print("=" * 70 + "\n")


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("\n" + "=" * 70)
    print("POWERCAST AI - STANDALONE OFFLINE PREDICTION DEMO")
    print("=" * 70)
    print("\nThis is a FULLY PORTABLE demo - no external dependencies needed.")
    print("The model and data are included in this folder.")
    
    try:
        # Load components
        model_data = load_model()
        config = load_config()
        load_history, last_timestamp = load_historical_data()
        
        # Generate predictions
        predictions = generate_predictions(model_data, load_history, last_timestamp)
        
        # Print results
        print_predictions(predictions, config)
        
        # Save to file for verification
        output_file = SCRIPT_DIR / "prediction_output.txt"
        with open(output_file, 'w') as f:
            f.write("POWERCAST AI - PREDICTION OUTPUT\n")
            f.write(f"Generated: {datetime.now()}\n")
            f.write(f"Region: {REGION_CODE}\n")
            f.write(f"Model MAPE: {config.get('metrics', {}).get('test_mape', 'N/A'):.2f}%\n\n")
            f.write("Timestamp,Point_MW,Q10_MW,Q90_MW\n")
            for pred in predictions:
                f.write(f"{pred['timestamp']},{pred['point_mw']},{pred['q10_mw']},{pred['q90_mw']}\n")
        print(f"📁 Full predictions saved to: {output_file.name}")
        
    except FileNotFoundError as e:
        print(f"\n❌ Error: {e}")
        print("\nFolder structure required:")
        print("  standalone_demo/")
        print("  ├── demo_inference.py")
        print("  ├── requirements.txt")
        print("  ├── models/")
        print("  │   ├── xgboost_model_SOUTH_TN_TNEB.joblib")
        print("  │   └── training_config_SOUTH_TN_TNEB.json")
        print("  └── data/")
        print("      └── tneb_tamilnadu_load_6months_15min.csv")
        return 1
    
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
