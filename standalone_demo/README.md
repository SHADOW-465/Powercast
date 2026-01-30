# Powercast AI - Standalone Offline Prediction Demo

**FULLY PORTABLE** - Move this entire folder anywhere and run predictions.

## Folder Structure

```
standalone_demo/
├── demo_inference.py      # Main prediction script
├── requirements.txt       # Python dependencies
├── README.md              # This file
├── models/
│   ├── xgboost_model_SOUTH_TN_TNEB.joblib  # Trained model (~80 MB)
│   └── training_config_SOUTH_TN_TNEB.json  # Model metadata
└── data/
    └── tneb_tamilnadu_load_6months_15min.csv  # Historical data (~1.2 MB)
```

## Quick Start

### Option 1: Direct Run (if dependencies installed)

```bash
cd standalone_demo
python demo_inference.py
```

### Option 2: Fresh Setup

```bash
cd standalone_demo

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run demo
python demo_inference.py
```

## Expected Output

```
======================================================================
POWERCAST AI - STANDALONE OFFLINE PREDICTION DEMO
======================================================================

📦 Loading model from: xgboost_model_SOUTH_TN_TNEB.joblib
   ✓ Loaded 96 XGBoost models

📊 Loading historical data from: tneb_tamilnadu_load_6months_15min.csv
   ✓ Loaded 17,472 rows

🔮 Generating predictions...

======================================================================
POWERCAST AI - LOAD FORECAST OUTPUT
======================================================================

📍 Region: SOUTH_TN_TNEB
⏰ Timezone: Asia/Kolkata
📈 Model MAPE: 2.49%
🕐 Forecast horizon: 24 hours (96 intervals)

----------------------------------------------------------------------
Timestamp            Prediction (MW)     Low (q10)    High (q90)
----------------------------------------------------------------------
2026-01-30 09:00          14,264.7      13,807.4      14,722.0
...
----------------------------------------------------------------------

✅ PREDICTION COMPLETE - Model is working correctly!
```

## Model Details

| Property | Value |
|----------|-------|
| Model Type | XGBoost (96 horizons) |
| Region | SOUTH_TN_TNEB (Tamil Nadu, India) |
| Test MAPE | 2.49% |
| Test MAE | 323.2 MW |
| Forecast Horizon | 24 hours |
| Interval | 15 minutes |
| Features | 21 (lags, rolling stats, calendar, weather) |

## Files Generated

After running, `prediction_output.txt` will be created with all 96 predictions in CSV format.
