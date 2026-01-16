# Powercast AI - MVP1 (XGBoost Edition)

> Intelligent Grid Forecasting Platform with XGBoost ML Engine and Swiss Precision Dark Theme

## Overview

MVP1 is a standalone implementation that migrates from LSTM to XGBoost for improved forecasting performance. Features include:

- **XGBoost ML Engine**: Faster training (~3hr vs days), better interpretability
- **Conformal Prediction**: Calibrated Q10/Q50/Q90 uncertainty intervals
- **Swiss Precision Dark Theme**: Premium glassmorphism UI with cyan/green accents
- **96-step Horizon**: 24-hour ahead forecasting at 15-minute intervals

---

## Quick Start

### 1. Backend Setup

```bash
cd MVP1/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd MVP1/frontend
npm install
npm run dev
# http://localhost:3000
```

### 3. Train XGBoost Model (Optional)

```bash
cd MVP1
python -X utf8 ml/training/train_xgboost.py
# Training takes ~3 hours on full dataset
# Model saved to ml/outputs/xgboost_forecaster.joblib
```

---

## Architecture

```
MVP1/
├── ml/
│   ├── models/xgboost_forecaster.py    # XGBoost model with conformal prediction
│   ├── data/features.py                 # 21 engineered features
│   ├── training/train_xgboost.py        # Automated training script
│   └── outputs/                         # Trained model artifacts
├── backend/
│   ├── app/
│   │   ├── main.py                      # FastAPI entry point
│   │   ├── api/                         # API routes
│   │   └── services/ml_inference.py     # XGBoost inference service
│   └── requirements.txt                 # XGBoost dependencies
├── frontend/
│   ├── src/
│   │   ├── app/globals.css              # Swiss Precision Dark theme
│   │   ├── components/dashboard/        # Dashboard components
│   │   └── lib/utils.ts                 # Utility functions
│   └── components.json                  # shadcn/ui config
├── data/
│   └── swiss_load_mock.csv              # Training data (70k rows)
└── vercel.json                          # Deployment config
```

---

## ML Model Details

### XGBoost Configuration
- **Estimators**: 500
- **Max Depth**: 7
- **Learning Rate**: 0.05
- **Objective**: Quantile regression (Q10, Q50, Q90)

### Feature Engineering (21 features)
1. **Lag Features**: Load at t-1, t-2, t-4, t-24, t-48, t-96, t-672 (1 week)
2. **Rolling Stats**: 4-step, 24-step, 96-step (mean, std, min, max)
3. **Calendar**: Hour, day of week, month, is_weekend (sin/cos encoded)
4. **Weather**: Temperature, solar irradiance, wind speed (if available)

### Target Performance
| Metric | Target | Expected |
|--------|--------|----------|
| MAPE | <3% | 2.5-2.8% |
| MAE | <250 MW | ~180 MW |
| Coverage (80%) | ~80% | 82% |

---

## Swiss Precision Dark Theme

### Color Palette
| Color | Hex | Usage |
|-------|-----|-------|
| Background | `#0a1628` | Primary dark navy |
| Secondary | `#0f2847` | Cards, sidebar |
| Cyan | `#00d4ff` | Primary accent, links |
| Green | `#00ff88` | Success, live indicators |
| Yellow | `#ffd700` | Warnings, solar charts |
| Orange | `#ff8c00` | Alerts, net import |
| Red | `#ff4444` | Danger, errors |

### Design Features
- Glassmorphism cards with `backdrop-filter: blur(10px)`
- Subtle glow effects on hover
- Smooth micro-animations
- Responsive grid layouts

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/grid/status` | GET | Current grid metrics |
| `/api/v1/forecast` | GET | XGBoost load forecast |
| `/api/v1/assets` | GET | Asset monitoring |
| `/api/v1/health` | GET | Service health check |

---

## Deployment

### Vercel (Recommended)

```bash
cd MVP1
vercel --prod
```

The `vercel.json` configures:
- Next.js frontend at `/`
- FastAPI backend at `/api/`

### Environment Variables

```env
NEXT_PUBLIC_API_URL=/api/v1
MODEL_PATH=ml/outputs/xgboost_forecaster.joblib
```

---

## Development Notes

### Running Without Trained Model

The backend falls back to mock data if no trained model is found:

```python
# backend/app/services/ml_inference.py
# Uses MockForecastService when model not available
```

### Training on Subset

For faster iteration, modify `train_xgboost.py`:

```python
# Use 10k rows instead of 70k
df = df.head(10000)
```

---

## Differences from Original Project

| Aspect | Original | MVP1 |
|--------|----------|------|
| ML Model | LSTM (PyTorch) | XGBoost |
| Training Time | ~24 hours | ~3 hours |
| Inference | GPU recommended | CPU-only |
| Theme | Default | Swiss Precision Dark |
| Dashboard | Basic | Enhanced glassmorphism |

---

## Files Modified from Original

MVP1 is a standalone copy. The original project remains unchanged:

- `ml/models/xgboost_forecaster.py` - New XGBoost model
- `ml/data/features.py` - New feature engineering
- `ml/training/train_xgboost.py` - New training script
- `backend/app/services/ml_inference.py` - XGBoost inference
- `backend/requirements.txt` - XGBoost deps (no PyTorch)
- `frontend/src/app/globals.css` - Swiss Precision theme
- `frontend/src/components/dashboard/` - New dashboard components

---

## License

Proprietary - Powercast AI Team

---

**Built with XGBoost + Next.js**
