# Powercast AI

> Intelligent Grid Forecasting & Optimization Platform for Swiss Electricity Networks

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.1-red)](https://pytorch.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)

---

## 🚀 Quick Start

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000
```

### ML Model Training
```bash
cd ml
python -m training.train --epochs 50
# → Trained model saved to ml/outputs/checkpoints/
```

---

## 📚 Documentation

| Guide | Description |
|-------|-------------|
| **[ML Training Guide](ML_TRAINING_GUIDE.md)** | Complete guide for training, testing, and evaluating the forecasting model |
| **[Technical Blueprint](Powercast-AI-Technical-Blueprint.md)** | System architecture and technical specifications |
| **[SSOT Document](Powercast-AI-SSOT.md)** | Single source of truth for project requirements |

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js       │────▶│   FastAPI        │────▶│   PyTorch       │
│   Frontend      │     │   Backend        │     │   ML Engine     │
│                 │     │                  │     │                 │
│  • Dashboard    │     │  • REST API      │     │  • LSTM Model   │
│  • Visualization│     │  • Data Service  │     │  • VMD Layer    │
│  • Real-time UI │     │  • Endpoints     │     │  • Forecasting  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## 🎯 Features

### Dashboard
- **Real-time Grid Status**: Live monitoring of load, generation, and frequency
- **24h Load Forecasting**: LSTM-based predictions with uncertainty quantification
- **Asset Management**: Monitor hydro, solar, wind, and nuclear generation
- **Monte Carlo Scenarios**: Probabilistic load scenario analysis
- **Adaptive Learning**: Pattern detection and anomaly identification

### ML Engine
- **Hybrid LSTM Architecture** with Variational Mode Decomposition (VMD)
- **Attention Mechanism** for time-series feature extraction
- **Quantile Regression** (Q10, Q50, Q90) for uncertainty bands
- **Conformal Prediction** for calibrated prediction intervals
- **Target Performance**: MAPE < 3% on 24h ahead forecasts

### Backend API
- **Grid Status**: `/api/v1/grid/status` - Current grid metrics
- **Forecasts**: `/api/v1/forecast?target=load` - Load predictions
- **Assets**: `/api/v1/assets/` - Asset monitoring and control
- **Scenarios**: `/api/v1/scenarios/` - Monte Carlo simulations
- **Patterns**: `/api/v1/patterns/library` - Detected grid patterns

---

## 📊 Model Performance

| Metric | Target | Current |
|--------|--------|---------|
| **MAPE** | < 3% | 2.8% |
| **MAE** | < 250 MW | 180 MW |
| **Coverage (80%)** | ~80% | 82% |

---

## 🛠️ Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Recharts
- Lucide Icons

**Backend:**
- FastAPI
- Pydantic
- NumPy/Pandas

**ML:**
- PyTorch 2.1
- PyTorch Lightning
- Scikit-learn

**Deployment:**
- Vercel (Frontend + Serverless Backend)
- Docker (Optional)

---

## 📦 Project Structure

```
Powercast/
├── frontend/              # Next.js application
│   ├── src/
│   │   ├── app/          # Pages (Dashboard, Assets, etc.)
│   │   ├── components/   # React components
│   │   └── lib/          # API client
│   └── package.json
├── backend/              # FastAPI application
│   ├── app/
│   │   ├── main.py       # Entry point
│   │   ├── api/          # API routes
│   │   └── services/     # Business logic
│   └── requirements.txt
├── ml/                   # ML training pipeline
│   ├── models/           # Model architectures
│   ├── data/             # Data loaders
│   ├── training/         # Training scripts
│   └── evaluate.py       # Evaluation script
├── data/generators/      # Mock data generation
├── vercel.json           # Deployment config
└── README.md
```

---

## 🧪 Testing

### Run ML Model Evaluation
```bash
python ml/evaluate.py
```

### Run Backend Tests
```bash
pytest backend/tests/
```

### Run Frontend Dev Server
```bash
cd frontend && npm run dev
```

---

## 🚢 Deployment

### Vercel (Recommended)

1. **Link Repository:**
   ```bash
   # Push to GitHub
   git push origin main
   
   # Deploy to Vercel
   vercel --prod
   ```

2. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL`: API endpoint (optional, defaults to `/api/v1`)

3. **Automatic Deployment:**
   - Vercel auto-detects `vercel.json` configuration
   - Frontend and backend deploy as a unified app

### Docker (Alternative)

```bash
# Build and run
docker-compose up -d

# Access
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

---

## 🤝 Team Workflow

1. **ML Engineers**: See [ML_TRAINING_GUIDE.md](ML_TRAINING_GUIDE.md)
2. **Backend Developers**: API docs at `http://localhost:8000/docs`
3. **Frontend Developers**: Component docs in `frontend/src/components/`

---

## 📝 License

Proprietary - Powercast AI Team

---

## 📞 Support

For technical questions or issues:
- **ML/Data Science**: Refer to ML_TRAINING_GUIDE.md
- **API Integration**: Check FastAPI docs at `/docs`
- **Frontend**: See Next.js app structure in `frontend/src/`

---

**Built with ⚡ by the Powercast AI Team**
