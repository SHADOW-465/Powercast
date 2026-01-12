"""
Powercast AI - Training Script
Train the hybrid LSTM forecasting model
"""
import os
import sys
import argparse
from datetime import datetime

import torch
import pytorch_lightning as pl
from pytorch_lightning.callbacks import (
    ModelCheckpoint,
    EarlyStopping,
    LearningRateMonitor,
    RichProgressBar
)
from pytorch_lightning.loggers import TensorBoardLogger

# Add paths
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.lstm_attention import HybridLSTMForecaster, ConformalPredictor
from data.dataset import DataPipeline
import numpy as np
import joblib


def train(args):
    """
    Main training function
    """
    print("=" * 60)
    print("POWERCAST AI - Model Training")
    print("=" * 60)
    
    # Set seed for reproducibility
    pl.seed_everything(args.seed)
    
    # Create data pipeline
    print("\n[1/5] Preparing data...")
    pipeline = DataPipeline(
        input_seq_len=args.input_seq_len,
        output_horizon=args.output_horizon,
        batch_size=args.batch_size,
        seed=args.seed
    )
    
    train_loader, val_loader, test_loader = pipeline.create_dataloaders(
        days=args.data_days
    )
    
    # Get input dimensions from data
    sample_x, sample_y = next(iter(train_loader))
    input_dim = sample_x.shape[-1]
    
    print(f"\nInput dimension: {input_dim}")
    print(f"Input sequence length: {args.input_seq_len}")
    print(f"Output horizon: {args.output_horizon}")
    
    # Create model
    print("\n[2/5] Creating model...")
    model = HybridLSTMForecaster(
        input_dim=input_dim,
        hidden_dim=args.hidden_dim,
        num_layers=args.num_layers,
        dropout=args.dropout,
        input_seq_len=args.input_seq_len,
        output_horizon=args.output_horizon,
        quantiles=[0.1, 0.5, 0.9],
        learning_rate=args.learning_rate,
        use_vmd=args.use_vmd
    )
    
    print(f"\nModel parameters: {sum(p.numel() for p in model.parameters()):,}")
    
    # Callbacks
    checkpoint_dir = os.path.join(args.output_dir, 'checkpoints')
    os.makedirs(checkpoint_dir, exist_ok=True)
    
    callbacks = [
        ModelCheckpoint(
            dirpath=checkpoint_dir,
            filename='powercast-{epoch:02d}-{val_mape:.2f}',
            monitor='val_mape',
            mode='min',
            save_top_k=3,
            save_last=True
        ),
        EarlyStopping(
            monitor='val_loss',
            patience=args.patience,
            mode='min',
            verbose=True
        ),
        LearningRateMonitor(logging_interval='epoch'),
        RichProgressBar()
    ]
    
    # Logger
    logger = TensorBoardLogger(
        save_dir=args.output_dir,
        name='logs',
        version=datetime.now().strftime('%Y%m%d_%H%M%S')
    )
    
    # Trainer
    print("\n[3/5] Training model...")
    trainer = pl.Trainer(
        max_epochs=args.epochs,
        accelerator='auto',
        devices=1,
        callbacks=callbacks,
        logger=logger,
        gradient_clip_val=1.0,
        precision='16-mixed' if torch.cuda.is_available() else 32,
        log_every_n_steps=10,
        enable_progress_bar=True
    )
    
    # Train
    trainer.fit(model, train_loader, val_loader)
    
    # Test
    print("\n[4/5] Testing model...")
    test_results = trainer.test(model, test_loader)
    
    # Conformal calibration
    print("\n[5/5] Calibrating conformal predictor...")
    model.eval()
    
    all_preds = []
    all_targets = []
    
    with torch.no_grad():
        for x, y in val_loader:
            outputs = model(x)
            all_preds.append(outputs['point'].cpu().numpy())
            all_targets.append(y.cpu().numpy())
    
    y_pred = np.concatenate(all_preds, axis=0)
    y_true = np.concatenate(all_targets, axis=0)
    
    # Calibrate conformal predictor
    conformal = ConformalPredictor(coverage=0.95)
    conformal.calibrate(y_pred, y_true)
    
    # Test coverage
    coverage = conformal.empirical_coverage(y_pred, y_true)
    print(f"Empirical coverage (target 95%): {coverage * 100:.1f}%")
    
    # Save conformal predictor
    conformal_path = os.path.join(args.output_dir, 'conformal_predictor.pkl')
    joblib.dump(conformal, conformal_path)
    print(f"\nConformal predictor saved to: {conformal_path}")
    
    # Save final model
    model_path = os.path.join(args.output_dir, 'final_model.ckpt')
    trainer.save_checkpoint(model_path)
    print(f"Final model saved to: {model_path}")
    
    print("\n" + "=" * 60)
    print("Training complete!")
    print("=" * 60)
    
    return model, conformal


def main():
    parser = argparse.ArgumentParser(description='Train Powercast AI forecasting model')
    
    # Data arguments
    parser.add_argument('--data-days', type=int, default=90,
                        help='Days of training data to generate')
    parser.add_argument('--input-seq-len', type=int, default=168,
                        help='Input sequence length (hours)')
    parser.add_argument('--output-horizon', type=int, default=96,
                        help='Forecast horizon (15-min intervals)')
    
    # Model arguments
    parser.add_argument('--hidden-dim', type=int, default=256,
                        help='LSTM hidden dimension')
    parser.add_argument('--num-layers', type=int, default=3,
                        help='Number of LSTM layers')
    parser.add_argument('--dropout', type=float, default=0.2,
                        help='Dropout rate')
    parser.add_argument('--use-vmd', action='store_true', default=True,
                        help='Use VMD decomposition')
    
    # Training arguments
    parser.add_argument('--epochs', type=int, default=50,
                        help='Maximum training epochs')
    parser.add_argument('--batch-size', type=int, default=32,
                        help='Batch size')
    parser.add_argument('--learning-rate', type=float, default=1e-3,
                        help='Learning rate')
    parser.add_argument('--patience', type=int, default=10,
                        help='Early stopping patience')
    parser.add_argument('--seed', type=int, default=42,
                        help='Random seed')
    
    # Output arguments
    parser.add_argument('--output-dir', type=str, default='./outputs',
                        help='Output directory')
    
    args = parser.parse_args()
    
    os.makedirs(args.output_dir, exist_ok=True)
    
    train(args)


if __name__ == "__main__":
    main()
