"""
Powercast AI - Model Evaluation Script
Evaluate trained LSTM model on test set and compute metrics
"""

import torch
import numpy as np
from ml.data.dataset import DataPipeline
from ml.models.lstm_attention import HybridLSTMForecaster
import matplotlib.pyplot as plt
from pathlib import Path

def evaluate_model(checkpoint_path='ml/outputs/checkpoints/best_model.ckpt'):
    """
    Comprehensive model evaluation
    
    Args:
        checkpoint_path: Path to trained model checkpoint
    
    Returns:
        dict: Dictionary of evaluation metrics
    """
    print("=" * 60)
    print("POWERCAST AI - MODEL EVALUATION")
    print("=" * 60)
    
    # Load model
    print(f"\nLoading model from: {checkpoint_path}")
    try:
        model = HybridLSTMForecaster.load_from_checkpoint(checkpoint_path)
        model.eval()
        print("✓ Model loaded successfully")
    except Exception as e:
        print(f"✗ Error loading model: {e}")
        return None
    
    # Load test data
    print("\nLoading test data...")
    try:
        pipeline = DataPipeline(train_days=365, val_days=30, test_days=30)
        test_loader = pipeline.test_dataloader()
        print(f"✓ Test set loaded: {len(test_loader)} batches")
    except Exception as e:
        print(f"✗ Error loading data: {e}")
        return None
    
    # Initialize metrics
    total_mape = 0
    total_mae = 0
    total_rmse = 0
    q10_violations = 0
    q90_violations = 0
    total_samples = 0
    count = 0
    
    all_actuals = []
    all_q10 = []
    all_q50 = []
    all_q90 = []
    
    print("\nEvaluating on test set...")
    with torch.no_grad():
        for batch in test_loader:
            x, y = batch
            predictions = model(x)
            
            # Extract quantiles
            pred_q10 = predictions[:, :, 0]
            pred_q50 = predictions[:, :, 1]  # Median
            pred_q90 = predictions[:, :, 2]
            
            # Calculate MAPE (using median prediction)
            mape = torch.mean(torch.abs((y - pred_q50) / (y + 1e-8))) * 100
            
            # Calculate MAE
            mae = torch.mean(torch.abs(y - pred_q50))
            
            # Calculate RMSE
            rmse = torch.sqrt(torch.mean((y - pred_q50) ** 2))
            
            # Check quantile coverage
            q10_violations += torch.sum(y < pred_q10).item()
            q90_violations += torch.sum(y > pred_q90).item()
            total_samples += y.numel()
            
            # Store for plotting
            all_actuals.extend(y.flatten().numpy())
            all_q10.extend(pred_q10.flatten().numpy())
            all_q50.extend(pred_q50.flatten().numpy())
            all_q90.extend(pred_q90.flatten().numpy())
            
            total_mape += mape.item()
            total_mae += mae.item()
            total_rmse += rmse.item()
            count += 1
    
    # Compute average metrics
    avg_mape = total_mape / count
    avg_mae = total_mae / count
    avg_rmse = total_rmse / count
    
    # Compute coverage rates
    q10_coverage = (1 - q10_violations / total_samples) * 100
    q90_coverage = (1 - q90_violations / total_samples) * 100
    interval_coverage = (1 - (q10_violations + (total_samples - q90_violations)) / total_samples) * 100
    
    # Print results
    print("\n" + "=" * 60)
    print("EVALUATION RESULTS")
    print("=" * 60)
    
    print("\n📊 Point Forecast Accuracy (Q50 - Median):")
    print(f"   MAPE:  {avg_mape:.2f}%")
    print(f"   MAE:   {avg_mae:.2f} MW")
    print(f"   RMSE:  {avg_rmse:.2f} MW")
    
    print("\n📈 Quantile Coverage Analysis:")
    print(f"   Q10 Coverage:      {q10_coverage:.1f}% (Target: ~90%)")
    print(f"   Q90 Coverage:      {q90_coverage:.1f}% (Target: ~90%)")
    print(f"   [Q10, Q90] Range:  {interval_coverage:.1f}% (Target: ~80%)")
    
    # Performance assessment
    print("\n🎯 Performance Assessment:")
    if avg_mape < 2.0:
        print("   Overall: ★★★★★ EXCELLENT")
    elif avg_mape < 3.0:
        print("   Overall: ★★★★☆ GOOD")
    elif avg_mape < 5.0:
        print("   Overall: ★★★☆☆ ACCEPTABLE")
    else:
        print("   Overall: ★★☆☆☆ NEEDS IMPROVEMENT")
    
    # Coverage assessment
    if 78 <= interval_coverage <= 82:
        print("   Uncertainty Quantification: ✓ Well-calibrated")
    else:
        print(f"   Uncertainty Quantification: ⚠ Coverage deviation ({interval_coverage:.1f}% vs 80% target)")
    
    # Save visualization
    print("\n📁 Generating visualizations...")
    output_dir = Path("ml/outputs")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Plot 1: Actual vs Predicted
    plt.figure(figsize=(14, 6))
    sample_size = min(500, len(all_actuals))
    indices = range(sample_size)
    
    plt.subplot(1, 2, 1)
    plt.scatter(all_actuals[:sample_size], all_q50[:sample_size], alpha=0.5, s=10)
    plt.plot([min(all_actuals), max(all_actuals)], 
             [min(all_actuals), max(all_actuals)], 'r--', linewidth=2, label='Perfect Prediction')
    plt.xlabel('Actual Load (MW)', fontsize=11)
    plt.ylabel('Predicted Load (MW)', fontsize=11)
    plt.title('Actual vs Predicted Load', fontsize=12, fontweight='bold')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    # Plot 2: Prediction Intervals
    plt.subplot(1, 2, 2)
    plt.fill_between(indices, 
                     [all_q10[i] for i in indices], 
                     [all_q90[i] for i in indices], 
                     alpha=0.3, label='80% Prediction Interval')
    plt.plot(indices, [all_q50[i] for i in indices], label='Median Forecast', linewidth=1.5)
    plt.plot(indices, [all_actuals[i] for i in indices], label='Actual Load', linewidth=1.5, linestyle='--', alpha=0.7)
    plt.xlabel('Sample Index', fontsize=11)
    plt.ylabel('Load (MW)', fontsize=11)
    plt.title('Forecast with Uncertainty Bands', fontsize=12, fontweight='bold')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plot_path = output_dir / "evaluation_results.png"
    plt.savefig(plot_path, dpi=150, bbox_inches='tight')
    print(f"   ✓ Saved plot to: {plot_path}")
    
    # Error distribution
    errors = np.array(all_actuals) - np.array(all_q50)
    plt.figure(figsize=(10, 5))
    plt.hist(errors, bins=50, edgecolor='black', alpha=0.7)
    plt.axvline(0, color='red', linestyle='--', linewidth=2, label='Zero Error')
    plt.xlabel('Prediction Error (MW)', fontsize=11)
    plt.ylabel('Frequency', fontsize=11)
    plt.title('Distribution of Prediction Errors', fontsize=12, fontweight='bold')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    error_plot_path = output_dir / "error_distribution.png"
    plt.savefig(error_plot_path, dpi=150, bbox_inches='tight')
    print(f"   ✓ Saved error distribution to: {error_plot_path}")
    
    metrics = {
        'mape': avg_mape,
        'mae': avg_mae,
        'rmse': avg_rmse,
        'q10_coverage': q10_coverage,
        'q90_coverage': q90_coverage,
        'interval_coverage': interval_coverage
    }
    
    print("\n" + "=" * 60)
    print("Evaluation complete!")
    print("=" * 60 + "\n")
    
    return metrics


def quick_test(checkpoint_path='ml/outputs/checkpoints/best_model.ckpt'):
    """Quick sanity check on a single batch"""
    print("Running quick sanity test...")
    
    model = HybridLSTMForecaster.load_from_checkpoint(checkpoint_path)
    model.eval()
    
    pipeline = DataPipeline(train_days=30, val_days=7, test_days=7)
    test_loader = pipeline.test_dataloader()
    
    x, y = next(iter(test_loader))
    
    with torch.no_grad():
        preds = model(x)
    
    print(f"✓ Single batch test passed")
    print(f"  Input shape: {x.shape}")
    print(f"  Output shape: {preds.shape}")
    print(f"  Q10 range: {preds[:, :, 0].min():.0f} - {preds[:, :, 0].max():.0f} MW")
    print(f"  Q50 range: {preds[:, :, 1].min():.0f} - {preds[:, :, 1].max():.0f} MW")
    print(f"  Q90 range: {preds[:, :, 2].min():.0f} - {preds[:, :, 2].max():.0f} MW")
    

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        checkpoint = sys.argv[1]
    else:
        checkpoint = 'ml/outputs/checkpoints/best_model.ckpt'
    
    # Run evaluation
    metrics = evaluate_model(checkpoint)
    
    if metrics:
        print("\n💾 Metrics Summary (copy for documentation):")
        print(f"MAPE: {metrics['mape']:.2f}%")
        print(f"MAE: {metrics['mae']:.2f} MW")
        print(f"RMSE: {metrics['rmse']:.2f} MW")
        print(f"Interval Coverage: {metrics['interval_coverage']:.1f}%")
