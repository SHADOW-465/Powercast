# Powercast AI - XGBoost Training Guide (Google Colab)

## Overview

This guide walks you through training the XGBoost forecasting model using Google Colab with GPU acceleration. Training typically takes **15-30 minutes** with the optimized single-step tuning approach.

---

## Prerequisites

1. **Google Account** - For accessing Google Colab
2. **Training Data** - `MVP1/data/swiss_load_mock.csv` (70,000 rows of Swiss grid load data)
3. **Training Script** - `MVP1/colab/powercast_xgboost_training.py`

---

## Step-by-Step Instructions

### 1. Open Google Colab

1. Go to [colab.research.google.com](https://colab.research.google.com)
2. Click **"New Notebook"**
3. Name it: `Powercast XGBoost Training`

### 2. Enable GPU Runtime

1. Click **Runtime** in the top menu
2. Click **Change runtime type**
3. Select **Hardware accelerator: GPU (T4)**
4. Click **Save**

**Why GPU?** While XGBoost is CPU-optimized, Colab GPU provides better performance and prevents session timeouts.

### 3. Upload Training Script

There are two ways to do this:

#### Option A: Copy-Paste (Recommended)

1. Open `MVP1/colab/powercast_xgboost_training.py` in your code editor
2. Copy the entire file content (Ctrl+A, Ctrl+C)
3. In Colab, create a new code cell
4. Paste the code (Ctrl+V)
5. Run the cell (Shift+Enter)

#### Option B: File Upload

```python
# In a new Colab cell:
from google.colab import files
uploaded = files.upload()  # Select powercast_xgboost_training.py
```

### 4. Upload Training Data

When the script runs, it will prompt you to upload `swiss_load_mock.csv`:

1. A file upload dialog will appear automatically
2. Navigate to `MVP1/data/`
3. Select `swiss_load_mock.csv`
4. Wait for upload to complete

**File Details:**
- Size: ~3 MB
- Rows: ~70,000 (2 years at 15-min intervals)
- Columns: timestamp, total_load_mw, nuclear_mw, hydro_mw, solar_mw, wind_mw, net_import_mw

### 5. Wait for Training

The training script will run automatically. Here's what to expect:

```
[1/5] Loading data...
  ✓ Loaded 70,000 rows
  ✓ Range: 2024-01-01 to 2026-01-01

[2/5] Fast hyperparameter tuning (single-step)...
  Single-step features: (68,523, 21)
  Using 20,000 samples for tuning (30%)

  Starting fast tuning...

  Trial   0/50 | MAPE: 3.245% | Best: 3.245% | Time: 0.5min
  Trial  10/50 | MAPE: 2.456% | Best: 2.342% | Time: 5.2min
  Trial  20/50 | MAPE: 2.234% | Best: 2.198% | Time: 10.1min
  Trial  30/50 | MAPE: 2.198% | Best: 2.198% | Time: 14.8min
  Trial  40/50 | MAPE: 2.156% | Best: 2.156% | Time: 19.5min
  Trial  49/50 | MAPE: 2.210% | Best: 2.156% | Time: 23.8min

  Tuning complete in 23.8 minutes
  Best single-step MAPE: 2.156%

  Best parameters:
    max_depth: 8
    learning_rate: 0.0412
    subsample: 0.8234
    colsample_bytree: 0.7654
    min_child_weight: 3
    gamma: 0.0456
    reg_alpha: 0.1234
    reg_lambda: 2.3456
    n_estimators: 500

[3/5] Creating multi-step features...
  ✓ Features: (67,000, 21)
  ✓ Targets: (67,000, 96)

[4/5] Training final multi-horizon model...
  Training 96 horizon models...
    Step 1/96...
    Step 25/96...
    Step 50/96...
    Step 75/96...
  ✓ Training complete in 180.2s

[5/5] Evaluating...
  Per-horizon MAPE:
    0.3h: 1.234%
    3.0h: 1.567%
    6.0h: 1.890%
    12.0h: 2.123%
    18.0h: 2.345%
    24.0h: 2.456%

  ✓ Test MAPE: 2.156%
  ✓ Coverage (90%): 89.3%
  ✓ Inference speed: 45.2ms

Saving model...
  ✓ Model: /content/powercast_xgboost_outputs/xgboost_model.joblib
  ✓ Config: /content/powercast_xgboost_outputs/training_config.json

TRAINING COMPLETE!

  RESULTS
  -------
  Test MAPE:      2.156%
  Test MAE:       168.4 MW
  Coverage (90%): 89.3%
  Tuning time:    23.8 min
  Training time:  180.2s
  Total time:     24.1 min
  Inference:      45.2ms

  SUCCESS CRITERIA
  -----------------
  MAPE < 3.0%:       ✓ PASS (2.156%)
  Coverage > 80%:    ✓ PASS (89.3%)
  Inference < 200ms:  ✓ PASS (45.2ms)

  📥 Downloading...
```

### 6. Download Trained Model

Two files will download automatically:

1. **xgboost_model.joblib** (~50 MB)
   - Contains 96 XGBoost models (one per 15-min horizon step)
   - Feature normalization parameters
   - Conformal prediction margins

2. **training_config.json** (~5 KB)
   - Best hyperparameters found
   - Performance metrics (MAPE, MAE, coverage)
   - Per-horizon accuracy breakdown

---

## Expected Results

| Metric | Target | Expected |
|--------|--------|----------|
| MAPE | <3% | **1.8-2.5%** |
| MAE | <250 MW | **150-180 MW** |
| Coverage (90%) | ~85-90% | **87-92%** |
| Inference Speed | <200ms | **40-60ms** |

---

## Training Time Breakdown

| Phase | Expected Time |
|-------|---------------|
| Data Loading | 10-20 seconds |
| Feature Engineering | 30-60 seconds |
| Hyperparameter Tuning | **15-25 minutes** |
| Model Training | 2-4 minutes |
| Evaluation | 10-20 seconds |
| **Total** | **~20-30 minutes** |

---

## Troubleshooting

### "Session disconnected"
- **Cause**: Colab session timeout (usually after 90 minutes of inactivity)
- **Fix**: Keep the Colab tab open. Consider Colab Pro for longer sessions.
- **If training was almost complete**: You can resume by re-running the training script with the same parameters.

### "Out of memory"
- **Cause**: Not enough RAM on Colab free tier
- **Fix**: Reduce `n_trials` from 50 to 25 in the `CONFIG` dict:
  ```python
  CONFIG = {
      "n_trials": 25,  # Reduced from 50
      ...
  }
  ```
- **Alternative**: Upgrade to Colab Pro for more RAM

### Training is very slow
- **Ensure GPU is enabled**: Runtime → Change runtime type → GPU
- **Check data size**: Should be ~3 MB, not larger
- **Reduce trials**: Set `n_trials = 25` for faster results

### "Module not found: xgboost"
The script automatically installs dependencies, but if you see this:
```python
!pip install xgboost==2.0.3 optuna pandas numpy scikit-learn joblib -q
```

### Training completes but MAPE is high (>4%)
- **Cause**: Data quality issues or insufficient training data
- **Fix**: Ensure `swiss_load_mock.csv` has at least 50,000 rows of valid data
- **Alternative**: Increase `tuning_estimators` from 100 to 200 in CONFIG

---

## After Training: Model Integration

### 1. Place Model in Project

Move the downloaded files to:

```
MVP1/
└── ml/
    └── outputs/
        ├── xgboost_model.joblib       ← Place here
        └── training_config.json      ← Place here
```

### 2. Restart Backend

```bash
# Stop current backend (if running)
# Ctrl+C in backend terminal

# Restart backend
cd MVP1/backend
python -m uvicorn app.main:app --reload --port 8000
```

### 3. Verify Model Loading

```bash
curl http://localhost:8000/health
```

Look for:
```json
{
  "ml_service": {
    "status": "healthy",        ← Should be "healthy" (not "degraded")
    "model_loaded": true,       ← Should be true
    "test_mape": 2.156,       ← Your MAPE value
    "coverage_90": 89.3        ← Your coverage value
  }
}
```

### 4. Test Forecast Endpoint

```bash
curl http://localhost:8000/api/v1/forecast?target=load
```

You should see:
- `metadata.model_type: "xgboost"` (not "mock")
- Realistic load values (6000-11000 MW)
- Tight prediction intervals (q90 - q10 ≈ 400-600 MW)

---

## Customizing Training

### Change Number of Trials

Edit `CONFIG` at the top of the script:

```python
CONFIG = {
    "n_trials": 100,      # More trials = better accuracy, slower
    # 25 trials: 10-15 min, slightly higher MAPE
    # 50 trials: 20-30 min, good balance (default)
    # 100 trials: 45-90 min, best accuracy
    ...
}
```

### Change Search Space

Fine-tune parameter ranges:

```python
CONFIG = {
    "search_space": {
        "max_depth": (4, 12),        # Deeper trees = more complex
        "learning_rate": (0.01, 0.2),  # Lower = slower, more accurate
        "subsample": (0.6, 1.0),    # Row sampling
        ...
    }
}
```

### Use More Training Data

Edit `train()` function:

```python
# In the data loading section, remove subset:
# df = df.head(10000)  # Remove this line to use full data
```

---

## Advanced: Running Locally (No Colab)

If you prefer to train locally:

```bash
cd MVP1
python -X utf8 ml/training/train_xgboost.py
```

**Requirements:**
- Python 3.9+
- 8 GB RAM minimum (16 GB recommended)
- Training time: 1-2 hours on CPU, 10-20 minutes on GPU

---

## Next Steps After Training

1. **Verify Model Accuracy**: Check MAPE is <3% and coverage >80%
2. **Test Full System**: Start backend + frontend, verify dashboard works
3. **Monitor Predictions**: Compare forecasts against actuals for a few days
4. **Consider Retraining**: Retrain weekly/monthly with new data

---

## Support

If you encounter issues:

1. Check the error message in Colab output
2. Verify data file size (~3 MB)
3. Ensure GPU runtime is enabled
4. Refer to [Training Script](powercast_xgboost_training.py) comments for details

---

**Training Checklist:**
- [ ] Opened Google Colab with GPU enabled
- [ ] Uploaded training script
- [ ] Uploaded swiss_load_mock.csv
- [ ] Training completed (MAPE <3%)
- [ ] Downloaded xgboost_model.joblib
- [ ] Downloaded training_config.json
- [ ] Placed files in MVP1/ml/outputs/
- [ ] Backend health shows "model_loaded": true
- [ ] Forecast endpoint returns XGBoost predictions
- [ ] Dashboard displays forecasts correctly

**When all checked, your model is ready for production! 🚀**
