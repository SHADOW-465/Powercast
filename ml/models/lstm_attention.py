"""
Powercast AI - Hybrid LSTM Model with Attention for Time Series Forecasting
Based on Technical Blueprint specifications
"""
import torch
import torch.nn as nn
import pytorch_lightning as pl
from typing import Dict, List, Tuple, Optional
import numpy as np


class VMDLayer(nn.Module):
    """
    Variational Mode Decomposition Layer (Simplified for Neural Network)
    Decomposes signal into trend, cyclical, and residual components
    """
    
    def __init__(self, n_modes: int = 3, hidden_dim: int = 64):
        super().__init__()
        self.n_modes = n_modes
        
        # Learnable filters for decomposition
        self.trend_filter = nn.Sequential(
            nn.Conv1d(1, hidden_dim, kernel_size=15, padding=7),
            nn.ReLU(),
            nn.Conv1d(hidden_dim, 1, kernel_size=15, padding=7)
        )
        
        self.cyclical_filter = nn.Sequential(
            nn.Conv1d(1, hidden_dim, kernel_size=7, padding=3),
            nn.ReLU(),
            nn.Conv1d(hidden_dim, 1, kernel_size=7, padding=3)
        )
        
    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        x: [batch, seq_len, features]
        Returns: trend, cyclical, residual each [batch, seq_len, features]
        """
        batch, seq_len, features = x.shape
        
        # Process each feature independently
        trends = []
        cyclicals = []
        residuals = []
        
        for f in range(features):
            signal = x[:, :, f:f+1].transpose(1, 2)  # [batch, 1, seq_len]
            
            trend = self.trend_filter(signal)  # [batch, 1, seq_len]
            cyclical = self.cyclical_filter(signal - trend)
            residual = signal - trend - cyclical
            
            trends.append(trend.transpose(1, 2))
            cyclicals.append(cyclical.transpose(1, 2))
            residuals.append(residual.transpose(1, 2))
        
        return (
            torch.cat(trends, dim=2),
            torch.cat(cyclicals, dim=2),
            torch.cat(residuals, dim=2)
        )


class AttentionLayer(nn.Module):
    """
    Bahdanau-style attention for temporal feature weighting
    """
    
    def __init__(self, hidden_dim: int, attention_dim: int = 64):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.attention_dim = attention_dim
        
        self.W_q = nn.Linear(hidden_dim, attention_dim)
        self.W_k = nn.Linear(hidden_dim, attention_dim)
        self.W_v = nn.Linear(hidden_dim, hidden_dim)
        self.v = nn.Linear(attention_dim, 1)
        
    def forward(self, hidden_states: torch.Tensor, mask: Optional[torch.Tensor] = None) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        hidden_states: [batch, seq_len, hidden_dim]
        Returns: context vector [batch, hidden_dim], attention weights [batch, seq_len]
        """
        # Query from last hidden state
        query = self.W_q(hidden_states[:, -1:, :])  # [batch, 1, attention_dim]
        keys = self.W_k(hidden_states)  # [batch, seq_len, attention_dim]
        
        # Compute attention scores
        scores = self.v(torch.tanh(query + keys))  # [batch, seq_len, 1]
        scores = scores.squeeze(-1)  # [batch, seq_len]
        
        if mask is not None:
            scores = scores.masked_fill(mask == 0, -1e9)
        
        attention_weights = torch.softmax(scores, dim=-1)  # [batch, seq_len]
        
        # Apply attention to values
        values = self.W_v(hidden_states)  # [batch, seq_len, hidden_dim]
        context = torch.bmm(attention_weights.unsqueeze(1), values)  # [batch, 1, hidden_dim]
        context = context.squeeze(1)  # [batch, hidden_dim]
        
        return context, attention_weights


class QuantileHead(nn.Module):
    """
    Quantile regression head for uncertainty estimation
    """
    
    def __init__(self, input_dim: int, output_horizon: int, quantiles: List[float]):
        super().__init__()
        self.quantiles = quantiles
        self.heads = nn.ModuleDict({
            f'q{int(q*100)}': nn.Linear(input_dim, output_horizon)
            for q in quantiles
        })
        
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        return {name: head(x) for name, head in self.heads.items()}


class HybridLSTMForecaster(pl.LightningModule):
    """
    Hybrid LSTM with VMD decomposition and attention for probabilistic forecasting
    
    Architecture:
    1. VMD Layer: Decompose into trend + cyclical + residual
    2. LSTM Encoder: Process each component
    3. Attention: Learn temporal importance
    4. LSTM Decoder: Generate forecasts
    5. Output Heads: Point forecast + quantiles
    """
    
    def __init__(
        self,
        input_dim: int = 42,
        hidden_dim: int = 256,
        num_layers: int = 3,
        dropout: float = 0.2,
        input_seq_len: int = 168,  # 7 days at 15-min intervals = 672, or 168 hours
        output_horizon: int = 96,   # 24 hours at 15-min intervals
        quantiles: List[float] = [0.1, 0.5, 0.9],
        learning_rate: float = 1e-3,
        use_vmd: bool = True
    ):
        super().__init__()
        self.save_hyperparameters()
        
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.output_horizon = output_horizon
        self.quantiles = quantiles
        self.learning_rate = learning_rate
        self.use_vmd = use_vmd
        
        # VMD decomposition (optional)
        if use_vmd:
            self.vmd = VMDLayer(n_modes=3, hidden_dim=64)
            encoder_input_dim = input_dim * 3  # trend + cyclical + residual
        else:
            self.vmd = None
            encoder_input_dim = input_dim
        
        # Feature embedding
        self.input_projection = nn.Linear(encoder_input_dim, hidden_dim)
        
        # LSTM Encoder
        self.encoder = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=False
        )
        
        # Attention mechanism
        self.attention = AttentionLayer(hidden_dim, attention_dim=64)
        
        # Decoder input projection
        self.decoder_input_proj = nn.Linear(hidden_dim + 1, hidden_dim)  # +1 for position encoding
        
        # LSTM Decoder
        self.decoder = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0
        )
        
        # Output heads
        self.point_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 1)
        )
        
        self.quantile_head = QuantileHead(hidden_dim, 1, quantiles)
        
        # Loss weights
        self.point_loss_weight = 1.0
        self.quantile_loss_weight = 0.5
        
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        x: [batch, seq_len, features]
        Returns: Dict with point forecasts and quantile predictions
        """
        batch_size = x.shape[0]
        
        # VMD decomposition
        if self.use_vmd and self.vmd is not None:
            trend, cyclical, residual = self.vmd(x)
            x_decomposed = torch.cat([trend, cyclical, residual], dim=-1)
        else:
            x_decomposed = x
        
        # Project to hidden dimension
        x_proj = self.input_projection(x_decomposed)  # [batch, seq_len, hidden_dim]
        
        # Encode
        encoder_out, (hidden, cell) = self.encoder(x_proj)
        # encoder_out: [batch, seq_len, hidden_dim]
        
        # Attention over encoder outputs
        context, attention_weights = self.attention(encoder_out)
        # context: [batch, hidden_dim]
        
        # Decode autoregressively for each horizon step
        point_forecasts = []
        quantile_forecasts = {f'q{int(q*100)}': [] for q in self.quantiles}
        
        # Initialize decoder state with encoder final state
        decoder_hidden = hidden
        decoder_cell = cell
        
        for t in range(self.output_horizon):
            # Position encoding (normalized time step)
            pos = torch.full((batch_size, 1), t / self.output_horizon, device=x.device)
            
            # Combine context with position
            decoder_input = torch.cat([context, pos], dim=-1)  # [batch, hidden_dim + 1]
            decoder_input = self.decoder_input_proj(decoder_input)  # [batch, hidden_dim]
            decoder_input = decoder_input.unsqueeze(1)  # [batch, 1, hidden_dim]
            
            # Decode one step
            decoder_out, (decoder_hidden, decoder_cell) = self.decoder(
                decoder_input, (decoder_hidden, decoder_cell)
            )
            decoder_out = decoder_out.squeeze(1)  # [batch, hidden_dim]
            
            # Generate predictions
            point = self.point_head(decoder_out)  # [batch, 1]
            point_forecasts.append(point)
            
            quantiles = self.quantile_head(decoder_out)  # Dict[str, [batch, 1]]
            for name, val in quantiles.items():
                quantile_forecasts[name].append(val)
            
            # Update context with decoder output for next step
            context = decoder_out
        
        # Stack predictions
        point_forecast = torch.cat(point_forecasts, dim=-1)  # [batch, output_horizon]
        
        result = {
            'point': point_forecast,
            'attention_weights': attention_weights
        }
        
        for name in quantile_forecasts:
            result[name] = torch.cat(quantile_forecasts[name], dim=-1)  # [batch, output_horizon]
        
        return result
    
    def quantile_loss(self, y_pred: torch.Tensor, y_true: torch.Tensor, quantile: float) -> torch.Tensor:
        """
        Pinball loss for quantile regression
        """
        errors = y_true - y_pred
        loss = torch.max(quantile * errors, (quantile - 1) * errors)
        return loss.mean()
    
    def compute_loss(self, outputs: Dict[str, torch.Tensor], y_true: torch.Tensor) -> Tuple[torch.Tensor, Dict]:
        """
        Combined loss: MSE for point + pinball for quantiles
        """
        # Point forecast loss (MSE)
        point_loss = nn.functional.mse_loss(outputs['point'], y_true)
        
        # Quantile losses
        quantile_losses = {}
        total_quantile_loss = 0
        for q in self.quantiles:
            name = f'q{int(q*100)}'
            q_loss = self.quantile_loss(outputs[name], y_true, q)
            quantile_losses[name] = q_loss
            total_quantile_loss += q_loss
        
        total_quantile_loss /= len(self.quantiles)
        
        # Combined loss
        total_loss = (
            self.point_loss_weight * point_loss + 
            self.quantile_loss_weight * total_quantile_loss
        )
        
        metrics = {
            'point_loss': point_loss,
            'quantile_loss': total_quantile_loss,
            **quantile_losses
        }
        
        return total_loss, metrics
    
    def training_step(self, batch, batch_idx):
        x, y = batch
        outputs = self(x)
        loss, metrics = self.compute_loss(outputs, y)
        
        self.log('train_loss', loss, prog_bar=True)
        self.log('train_point_loss', metrics['point_loss'])
        self.log('train_quantile_loss', metrics['quantile_loss'])
        
        return loss
    
    def validation_step(self, batch, batch_idx):
        x, y = batch
        outputs = self(x)
        loss, metrics = self.compute_loss(outputs, y)
        
        # Calculate MAPE
        mape = torch.mean(torch.abs((y - outputs['point']) / (y + 1e-8))) * 100
        
        # Calculate MAE
        mae = torch.mean(torch.abs(y - outputs['point']))
        
        # Calculate coverage (what % of actuals fall within q10-q90)
        in_interval = (y >= outputs['q10']) & (y <= outputs['q90'])
        coverage = in_interval.float().mean() * 100
        
        self.log('val_loss', loss, prog_bar=True)
        self.log('val_mape', mape, prog_bar=True)
        self.log('val_mae', mae)
        self.log('val_coverage_80', coverage)
        
        return {'val_loss': loss, 'val_mape': mape, 'val_coverage': coverage}
    
    def test_step(self, batch, batch_idx):
        return self.validation_step(batch, batch_idx)
    
    def configure_optimizers(self):
        optimizer = torch.optim.AdamW(
            self.parameters(),
            lr=self.learning_rate,
            weight_decay=1e-5
        )
        
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer,
            mode='min',
            factor=0.5,
            patience=5,
            min_lr=1e-6
        )
        
        return {
            'optimizer': optimizer,
            'lr_scheduler': {
                'scheduler': scheduler,
                'monitor': 'val_loss',
                'frequency': 1
            }
        }


class ConformalPredictor:
    """
    Conformal prediction for calibrated uncertainty intervals
    Provides coverage guarantees regardless of model quality
    """
    
    def __init__(self, coverage: float = 0.95):
        self.coverage = coverage
        self.calibration_quantiles = {}
        
    def calibrate(
        self, 
        y_pred: np.ndarray, 
        y_true: np.ndarray,
        horizon_buckets: Optional[List[int]] = None
    ) -> None:
        """
        Calibrate on validation set
        
        Args:
            y_pred: Point predictions [n_samples, horizon]
            y_true: Actual values [n_samples, horizon]
            horizon_buckets: Optional grouping of horizon steps
        """
        residuals = np.abs(y_true - y_pred)
        
        if horizon_buckets is None:
            # Single calibration for all horizons
            flat_residuals = residuals.flatten()
            self.calibration_quantiles['global'] = np.quantile(
                flat_residuals, 
                self.coverage
            )
        else:
            # Per-bucket calibration
            for bucket_name, indices in horizon_buckets.items():
                bucket_residuals = residuals[:, indices].flatten()
                self.calibration_quantiles[bucket_name] = np.quantile(
                    bucket_residuals,
                    self.coverage
                )
    
    def predict_interval(
        self, 
        y_pred: np.ndarray,
        bucket: str = 'global'
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate prediction intervals
        
        Returns:
            lower, upper bounds
        """
        q = self.calibration_quantiles.get(bucket, self.calibration_quantiles.get('global'))
        return y_pred - q, y_pred + q
    
    def empirical_coverage(
        self,
        y_pred: np.ndarray,
        y_true: np.ndarray,
        bucket: str = 'global'
    ) -> float:
        """
        Calculate empirical coverage on test set
        """
        lower, upper = self.predict_interval(y_pred, bucket)
        in_interval = (y_true >= lower) & (y_true <= upper)
        return np.mean(in_interval)


if __name__ == "__main__":
    # Test model instantiation
    model = HybridLSTMForecaster(
        input_dim=42,
        hidden_dim=256,
        num_layers=3,
        output_horizon=96
    )
    
    # Test forward pass
    batch_size = 4
    seq_len = 168
    x = torch.randn(batch_size, seq_len, 42)
    
    outputs = model(x)
    print(f"Point forecast shape: {outputs['point'].shape}")
    print(f"Q10 shape: {outputs['q10'].shape}")
    print(f"Q50 shape: {outputs['q50'].shape}")
    print(f"Q90 shape: {outputs['q90'].shape}")
    print(f"Attention weights shape: {outputs['attention_weights'].shape}")
