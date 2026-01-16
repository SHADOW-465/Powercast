# Powercast AI - XGBoost Training (Optuna Tuned)

Production-grade XGBoost training with **Bayesian hyperparameter optimization**.

## Files

| File | Description |
|------|-------------|
| `powercast_xgboost_training.py` | Complete training script with Optuna tuning |

## Quick Start

### 1. Open Google Colab

Go to [colab.research.google.com](https://colab.research.google.com)

### 2. Create New Notebook

- Click **File → New notebook**
- Click **Runtime → Change runtime type → GPU (T4)**

### 3. Run Training

Paste the entire content of `powercast_xgboost_training.py` into a cell and run it.

Or upload and run:
```python
# Cell 1: Upload and run
from google.colab import files
uploaded = files.upload()  # Upload powercast_xgboost_training.py
exec(open('powercast_xgboost_training.py').read())
```

### 4. Upload Data

When prompted, upload `swiss_load_mock.csv` from `MVP1/data/`

### 5. Wait for Training

Training takes 20-50 minutes for 100 Optuna trials.

### 6. Download Model

Files auto-download when complete:
- `xgboost_model.joblib`
- `training_config.json`

Place them in `MVP1/ml/outputs/`

## What The Script Does

```
[1/6] Loading data...
      ✓ Loads swiss_load_mock.csv
      ✓ Shows data range and columns

[2/6] Engineering features...
      ✓ Creates 21 features (lags, rolling, calendar, weather)
      ✓ Shows feature and target shapes

[3/6] Splitting data...
      ✓ Train / Calibration / Test split
      ✓ Shows sample counts

[4/6] Hyperparameter tuning with Optuna...
      ✓ 100 trials with TPE sampler
      ✓ 5-fold time-series CV
      ✓ Progress every 10 trials
      ✓ Early stopping if no improvement

[5/6] Training final model...
      ✓ Uses best parameters from Optuna
      ✓ Calibrates conformal prediction

[6/6] Evaluating on test set...
      ✓ Per-horizon MAPE (1h, 6h, 12h, 18h, 24h)
      ✓ Coverage metrics (80%, 90%)
      ✓ Feature importance
      ✓ Inference speed
```

## Configuration

Edit the `CONFIG` dict at the top of the script:

```python
CONFIG = {
    "n_trials": 100,        # Optuna trials (50=faster, 200=more accurate)
    "n_cv_folds": 5,        # CV folds
    "test_days": 30,        # Days for testing
    "calibration_days": 15, # Days for conformal calibration
    ...
}
```

## Search Space

| Parameter | Range | Scale |
|-----------|-------|-------|
| n_estimators | 300-2000 | linear |
| max_depth | 4-12 | linear |
| learning_rate | 0.01-0.2 | log |
| subsample | 0.6-1.0 | linear |
| colsample_bytree | 0.5-1.0 | linear |
| min_child_weight | 1-10 | linear |
| gamma | 0-0.5 | linear |
| reg_alpha | 0-1.0 | linear |
| reg_lambda | 0.1-10.0 | log |

## Expected Results

| Metric | Without Tuning | With Tuning |
|--------|---------------|-------------|
| MAPE | 2.5-3.0% | **1.8-2.5%** |
| MAE | 180-220 MW | **150-180 MW** |
| Coverage (90%) | 80-85% | **87-92%** |

## Training Time

| Trials | Time |
|--------|------|
| 50 | 10-20 min |
| 100 | 20-45 min |
| 200 | 45-90 min |

## Output: training_config.json

```json
{
  "model_type": "xgboost_optuna_tuned",
  "best_params": {
    "n_estimators": 1247,
    "max_depth": 9,
    "learning_rate": 0.0342,
    ...
  },
  "tuning": {
    "n_trials": 100,
    "best_cv_mape": 2.156,
    "tuning_time_minutes": 32.5
  },
  "metrics": {
    "test_mape": 2.034,
    "test_mae": 168.4,
    "coverage_90": 89.3
  },
  "horizon_mape": {
    "1.0h": 1.2,
    "6.0h": 1.8,
    "12.0h": 2.1,
    "24.0h": 2.4
  }
}
```

## Troubleshooting

### "Session disconnected"
Keep the Colab tab active. Consider Colab Pro for longer sessions.

### "Out of memory"
Reduce `n_trials` from 100 to 50.

### Slow training
- Ensure GPU is enabled: **Runtime → Change runtime type → GPU**
- Reduce `n_trials` for faster results

## After Training

1. Download `xgboost_model.joblib` and `training_config.json`
2. Place in `MVP1/ml/outputs/`
3. Start backend: `cd MVP1/backend && uvicorn app.main:app --reload`
4. Start frontend: `cd MVP1/frontend && npm run dev`
