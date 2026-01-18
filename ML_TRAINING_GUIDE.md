# Powercast AI - ML Model Training & Evaluation Guide

> **Complete guide for training, testing, and validating the LSTM-based load forecasting model**

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Data Preparation](#data-preparation)
4. [Training the Model](#training-the-model)
5. [Model Evaluation](#model-evaluation)
6. [Testing & Validation](#testing--validation)
7. [Understanding Metrics](#understanding-metrics)
8. [Advanced Configuration](#advanced-configuration)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Powercast AI forecasting engine uses a **Hybrid LSTM with Attention** architecture that includes:
- **VMD (Variational Mode Decomposition)** for signal preprocessing
- **Bidirectional LSTM** encoder with attention mechanism
- **Quantile Regression** heads (Q10, Q50, Q90) for uncertainty quantification
- **Conformal Prediction** for calibrated prediction intervals

**Model Architecture:**
```
Input (96 timesteps) → VMD Decomposition → LSTM Encoder → Attention → Quantile Heads → Output (Q10, Q50, Q90)
```

---

## Prerequisites

### 1. Environment Setup

```bash
# Navigate to project root
cd c:\Users\ROCKSTAR SHOWMIK\Documents\Projects\Powercast

# Install Python dependencies
cd backend
pip install -r requirements.txt
```

### 2. Required Dependencies

Ensure the following are installed:
- Python 3.9+
- PyTorch 2.1+
- PyTorch Lightning 2.1+
- NumPy, Pandas, Scikit-learn

### 3. Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **RAM** | 8 GB | 16 GB |
| **GPU** | Optional | CUDA-compatible (NVIDIA) |
| **Storage** | 2 GB | 5 GB |

---

## Data Preparation

### Step 1: Generate Mock Training Data

Our system includes realistic Swiss grid data generators:

```bash
cd data/generators
python -c "from mock_data import DataService; ds = DataService(); print('Data service initialized')"
```

**What this does:**
- Generates SCADA load data with realistic daily/seasonal patterns
- Creates weather features (temperature, solar irradiance, wind speed)
- Simulates market price data (EPEX SPOT-style)
- Generates asset generation profiles

### Step 2: Verify Data Quality

```python
# Quick data inspection script
from data.generators.mock_data import SCADAGenerator
import pandas as pd

gen = SCADAGenerator()
scada_data = gen.generate_24h()

print(f"Records generated: {len(scada_data)}")
print(f"Load range: {scada_data['load_mw'].min():.0f} - {scada_data['load_mw'].max():.0f} MW")
print(f"Frequency range: {scada_data['frequency_hz'].min():.2f} - {scada_data['frequency_hz'].max():.2f} Hz")
```

**Expected Output:**
```
Records generated: 96
Load range: 6800 - 9500 MW
Frequency range: 49.95 - 50.05 Hz
```

---

## Training the Model

### Basic Training

```bash
cd ml
python -m training.train --epochs 50 --batch_size 32 --learning_rate 0.001
```

### Training Parameters

| Parameter | Description | Default | Recommended Range |
|-----------|-------------|---------|-------------------|
| `--epochs` | Number of training epochs | 50 | 30-100 |
| `--batch_size` | Batch size | 32 | 16-64 |
| `--learning_rate` | Initial learning rate | 0.001 | 0.0001-0.01 |
| `--hidden_size` | LSTM hidden units | 256 | 128-512 |
| `--num_layers` | LSTM layers | 3 | 2-4 |
| `--dropout` | Dropout rate | 0.2 | 0.1-0.3 |

### Example: Full Training Command

```bash
python -m training.train \
  --epochs 100 \
  --batch_size 32 \
  --learning_rate 0.001 \
  --hidden_size 256 \
  --num_layers 3 \
  --dropout 0.2 \
  --device cuda
```

### Training Output

You should see output like:

```
Epoch 1/100
  Train Loss: 0.2451 | Val Loss: 0.2103 | MAPE: 3.2%
Epoch 10/100
  Train Loss: 0.1203 | Val Loss: 0.1156 | MAPE: 2.1%
...
Best model saved to: ml/outputs/checkpoints/best_model.ckpt
```

### What Happens During Training?

1. **Data Loading**: Historical load data is split into train/validation/test sets (70/15/15)
2. **Preprocessing**: VMD decomposition extracts frequency components
3. **Training Loop**: Model learns to predict Q10, Q50, Q90 quantiles
4. **Validation**: Model performance is checked every epoch
5. **Early Stopping**: Training stops if validation loss doesn't improve for 10 epochs
6. **Checkpointing**: Best model is saved based on validation MAPE

---

## Model Evaluation

### Step 1: Load Trained Model

```python
from ml.models.lstm_attention import HybridLSTMForecaster
import torch

# Load checkpoint
checkpoint = torch.load('ml/outputs/checkpoints/best_model.ckpt')
model = HybridLSTMForecaster.load_from_checkpoint('ml/outputs/checkpoints/best_model.ckpt')
model.eval()
```

### Step 2: Run Evaluation Script

```python
# ml/evaluate.py
import torch
from ml.data.dataset import DataPipeline
from ml.models.lstm_attention import HybridLSTMForecaster

def evaluate_model():
    # Load model
    model = HybridLSTMForecaster.load_from_checkpoint('ml/outputs/checkpoints/best_model.ckpt')
    model.eval()
    
    # Load test data
    pipeline = DataPipeline(train_days=365, val_days=30, test_days=30)
    test_loader = pipeline.test_dataloader()
    
    # Compute metrics
    total_mape = 0
    total_mae = 0
    count = 0
    
    with torch.no_grad():
        for batch in test_loader:
            x, y = batch
            predictions = model(x)
            
            # Q50 (median) prediction
            pred_median = predictions[:, :, 1]  # Q50
            
            # Calculate MAPE
            mape = torch.mean(torch.abs((y - pred_median) / y)) * 100
            mae = torch.mean(torch.abs(y - pred_median))
            
            total_mape += mape.item()
            total_mae += mae.item()
            count += 1
    
    avg_mape = total_mape / count
    avg_mae = total_mae / count
    
    print(f"Test Set Performance:")
    print(f"  MAPE: {avg_mape:.2f}%")
    print(f"  MAE:  {avg_mae:.2f} MW")
    
    return avg_mape, avg_mae

if __name__ == "__main__":
    evaluate_model()
```

**Run evaluation:**
```bash
python ml/evaluate.py
```

### Expected Performance Benchmarks

| Metric | Excellent | Good | Acceptable | Poor |
|--------|-----------|------|------------|------|
| **MAPE** | < 2% | 2-3% | 3-5% | > 5% |
| **MAE** | < 150 MW | 150-250 MW | 250-400 MW | > 400 MW |
| **Coverage (90%)** | > 92% | 88-92% | 85-88% | < 85% |

---

## Testing & Validation

### 1. Quantile Coverage Test

Verify that prediction intervals have correct coverage:

```python
def test_quantile_coverage(model, test_loader):
    q10_violations = 0
    q90_violations = 0
    total = 0
    
    with torch.no_grad():
        for x, y in test_loader:
            preds = model(x)
            q10 = preds[:, :, 0]
            q90 = preds[:, :, 2]
            
            # Check if actual values fall within [Q10, Q90]
            q10_violations += torch.sum(y < q10).item()
            q90_violations += torch.sum(y > q90).item()
            total += y.numel()
    
    q10_coverage = (1 - q10_violations / total) * 100
    q90_coverage = (1 - q90_violations / total) * 100
    
    print(f"Q10 Coverage: {q10_coverage:.1f}% (Target: ~90%)")
    print(f"Q90 Coverage: {q90_coverage:.1f}% (Target: ~90%)")
```

**Interpretation:**
- **Q10 Coverage ~90%**: About 90% of actual values should be above Q10
- **Q90 Coverage ~90%**: About 90% of actual values should be below Q90

### 2. Temporal Consistency Test

Check if forecasts are stable across time:

```python
def test_temporal_consistency(model, data):
    forecasts = []
    
    for t in range(100):
        x = data[t:t+96]
        pred = model(x.unsqueeze(0))
        forecasts.append(pred[:, 0, 1].item())  # Q50 at first timestep
    
    # Calculate hour-over-hour change
    changes = [abs(forecasts[i+1] - forecasts[i]) for i in range(len(forecasts)-1)]
    avg_change = sum(changes) / len(changes)
    
    print(f"Average hourly forecast change: {avg_change:.2f} MW")
    print(f"Max change: {max(changes):.2f} MW")
```

**Acceptable Range:**
- Average change: < 200 MW
- Max change: < 800 MW

### 3. Visual Inspection

```python
import matplotlib.pyplot as plt

def plot_forecast(model, test_data, index=0):
    x, y_true = test_data[index]
    
    with torch.no_grad():
        preds = model(x.unsqueeze(0))
    
    q10 = preds[0, :, 0].numpy()
    q50 = preds[0, :, 1].numpy()
    q90 = preds[0, :, 2].numpy()
    y_true = y_true.numpy()
    
    plt.figure(figsize=(12, 6))
    plt.fill_between(range(96), q10, q90, alpha=0.3, label='80% Prediction Interval')
    plt.plot(q50, label='Q50 (Median Forecast)', linewidth=2)
    plt.plot(y_true, label='Actual Load', linewidth=2, linestyle='--')
    plt.xlabel('Timestep (15-min intervals)')
    plt.ylabel('Load (MW)')
    plt.legend()
    plt.title('24-Hour Load Forecast vs Actual')
    plt.grid(True, alpha=0.3)
    plt.savefig('ml/outputs/forecast_sample.png', dpi=150)
    plt.show()
```

---

## Understanding Metrics

### MAPE (Mean Absolute Percentage Error)

**Formula:** `MAPE = (1/n) * Σ |actual - predicted| / |actual| * 100`

**What it means:**
- **2.5% MAPE** = On average, forecasts are within ±2.5% of actual load
- For 8000 MW load, this is ±200 MW error

**Why it matters:**
- Industry standard for load forecasting
- Easy to interpret and compare across regions

### MAE (Mean Absolute Error)

**Formula:** `MAE = (1/n) * Σ |actual - predicted|`

**What it means:**
- **150 MW MAE** = On average, forecasts deviate by 150 MW

**Why it matters:**
- Directly interpretable in MW
- Not affected by percentage calculation issues (e.g., near-zero values)

### Coverage Rate

**Formula:** `Coverage = % of actual values falling within [Q10, Q90]`

**Target:** ~80% coverage for 80% prediction interval

**What it means:**
- **85% coverage** = 85% of the time, actual load falls within our predicted range

**Why it matters:**
- Indicates whether uncertainty estimates are well-calibrated
- Critical for reserve planning

---

## Advanced Configuration

### 1. Hyperparameter Tuning

Use `hyperparameter_search.py` to find optimal settings:

```python
# ml/hyperparameter_search.py
from pytorch_lightning.callbacks import EarlyStopping
from ray import tune
from ray.tune.integration.pytorch_lightning import TuneReportCallback

config = {
    "learning_rate": tune.loguniform(1e-4, 1e-2),
    "hidden_size": tune.choice([128, 256, 512]),
    "num_layers": tune.choice([2, 3, 4]),
    "dropout": tune.uniform(0.1, 0.3)
}

# Run tuning (see full script in ml/hyperparameter_search.py)
```

### 2. Custom Loss Functions

Modify `ml/models/lstm_attention.py` to use custom losses:

```python
def quantile_loss(self, y_pred, y_true, quantiles=[0.1, 0.5, 0.9]):
    losses = []
    for i, q in enumerate(quantiles):
        errors = y_true - y_pred[:, :, i]
        losses.append(torch.max(q * errors, (q - 1) * errors))
    return torch.mean(torch.stack(losses))
```

### 3. Transfer Learning

Fine-tune on new data:

```python
# Load pre-trained model
model = HybridLSTMForecaster.load_from_checkpoint('best_model.ckpt')

# Freeze VMD and early LSTM layers
for param in model.vmd_layer.parameters():
    param.requires_grad = False

# Train on new data with lower learning rate
trainer = pl.Trainer(max_epochs=20, learning_rate=1e-4)
trainer.fit(model, new_dataloader)
```

---

## Troubleshooting

### Issue 1: Model Not Converging

**Symptoms:** Loss stays high or increases

**Solutions:**
1. **Reduce learning rate**: Try `--learning_rate 0.0001`
2. **Check data scaling**: Ensure inputs are normalized
3. **Increase batch size**: Try `--batch_size 64`
4. **Add gradient clipping**: Modify trainer with `gradient_clip_val=1.0`

### Issue 2: Overfitting

**Symptoms:** Train loss << Val loss

**Solutions:**
1. **Increase dropout**: Try `--dropout 0.3`
2. **Add weight decay**: Modify optimizer with `weight_decay=1e-5`
3. **Reduce model capacity**: Use `--hidden_size 128 --num_layers 2`
4. **Get more training data**: Increase `train_days` parameter

### Issue 3: Poor Quantile Coverage

**Symptoms:** Coverage rate far from target (e.g., 60% instead of 80%)

**Solutions:**
1. **Recalibrate conformal predictor**: Increase calibration set size
2. **Adjust quantile loss weights**: Modify loss function
3. **Check for distribution shift**: Ensure train/test data similarity

### Issue 4: GPU Out of Memory

**Symptoms:** CUDA OOM error

**Solutions:**
```bash
# Reduce batch size
python -m training.train --batch_size 16

# Use gradient accumulation
python -m training.train --accumulate_grad_batches 2

# Enable mixed precision
python -m training.train --precision 16
```

---

## Quick Reference Commands

```bash
# Train model (basic)
python -m training.train --epochs 50

# Train with GPU
python -m training.train --epochs 100 --device cuda

# Evaluate model
python ml/evaluate.py

# View training logs
tensorboard --logdir ml/outputs/tb_logs

# Generate forecast
python -m ml.inference --checkpoint ml/outputs/checkpoints/best_model.ckpt
```

---

## Team Workflow Checklist

- [ ] **Setup**: Install dependencies and verify environment
- [ ] **Data**: Generate and inspect mock training data
- [ ] **Train**: Run training with default parameters first
- [ ] **Monitor**: Check TensorBoard for loss curves
- [ ] **Evaluate**: Run evaluation script on test set
- [ ] **Validate**: Check MAPE < 3% and coverage ~80%
- [ ] **Test**: Run temporal consistency and visual checks
- [ ] **Tune**: If needed, adjust hyperparameters
- [ ] **Document**: Record final metrics and configuration
- [ ] **Deploy**: Copy best checkpoint to production

---

## Support & Resources

- **Model Architecture**: See `ml/models/lstm_attention.py`
- **Data Pipeline**: See `ml/data/dataset.py`
- **Training Script**: See `ml/training/train.py`
- **Technical Blueprint**: See `Powercast-AI-Technical-Blueprint.md`

For questions, contact the ML team or refer to the main project documentation.
