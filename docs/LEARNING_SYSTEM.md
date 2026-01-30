# Closed-Loop Learning System - Architecture Guide

## Overview

The Closed-Loop Context-Aware Self-Correcting Forecasting System adds intelligent learning capabilities to the Powercast AI forecasting platform. It learns from past forecast errors, identifies patterns, and applies safe, explainable adjustments to future forecasts.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FORECAST PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Request    ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│   ──────────▶│ ML Model    │───▶│ Forecast        │───▶│ API Response    │ │
│              │ (XGBoost)   │    │ Adjuster        │    │ with metadata   │  │
│              └─────────────┘    └────────┬────────┘    └─────────────────┘  │
│                                          │                                  │
│                     ┌────────────────────┼────────────────────┐             │
│                     │                    │                    │             │
│              ┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐      │
│              │ Forecast    │      │ Context     │      │ Rule        │      │
│              │ Logger      │      │ Engine      │      │ Engine      │      │
│              └──────┬──────┘      └──────┬──────┘      └──────┬──────┘      │
│                     │                    │                    │             │
└─────────────────────┼────────────────────┼────────────────────┼─────────────┘
                      │                    │                    │
┌─────────────────────┼────────────────────┼────────────────────┼──────────────┐
│                     │      LEARNING MEMORY (Supabase)         │              │
├─────────────────────┼────────────────────┼────────────────────┼──────────────┤
│              ┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐       │
│              │ forecast_   │      │ context_    │      │ generalized │       │
│              │ events      │      │ snapshots   │      │ _lessons    │       │
│              └─────────────┘      │ (pgvector)  │      └─────────────┘       │
│                                   └─────────────┘                            │
│              ┌─────────────┐                           ┌─────────────┐       │
│              │ forecast_   │                           │ rule_       │       │
│              │ errors      │                           │ applications│       │
│              └──────▲──────┘                           └─────────────┘       │
└─────────────────────┼────────────────────────────────────────────────────────┘
                      │
┌─────────────────────┼────────────────────────────────────────────────────────┐
│                     │      ERROR ANALYSIS LOOP                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│              ┌──────┴──────┐      ┌─────────────┐      ┌─────────────┐       │
│   Actuals───▶│ Error       │─────▶│ LLM         │─────▶│ Store       │      │
│   Available  │ Observer    │      │ Reasoning   │      │ Lesson      │       │
│              └─────────────┘      │ (Gemini)    │      └─────────────┘       │
│                                   └─────────────┘                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Forecast Logger (`forecast_logger.py`)
- Logs every forecast to `forecast_events` table
- Immutable audit trail of all predictions
- Includes model version, region, timestamps, predictions

### 2. Error Observer (`error_observer.py`)
- Compares predictions to actuals when available
- Classifies errors: MAPE spike, peak miss, ramp error, variance
- Triggers analysis for HIGH/CRITICAL severity

### 3. Context Engine (`context_engine.py`)
- Gathers weather, grid, and event context
- Creates vector embeddings via Gemini text-embedding-004
- Stores in Supabase pgvector for similarity search

### 4. LLM Reasoning (`llm_reasoning.py`)
- Analyzes errors with context using Gemini
- Outputs structured JSON only
- Validates all outputs against schema
- Creates generalized lessons

### 5. Rule Engine (`rule_engine.py`)
- Matches current context to learned lessons
- Applies confidence-weighted adjustments
- Caps all adjustments at ±15%
- Full audit logging

### 6. Forecast Adjuster (`forecast_adjuster.py`)
- Orchestrates the adjustment pipeline
- Feature flags for enable/disable
- Non-blocking, graceful degradation

## Database Schema

See `supabase/migrations/20260130_learning_memory.sql`

| Table | Purpose |
|-------|---------|
| `forecast_events` | Immutable log of all forecasts |
| `forecast_errors` | Detected deviations from actuals |
| `context_snapshots` | RAG-indexed context with embeddings |
| `generalized_lessons` | LLM-extracted patterns and rules |
| `rule_applications` | Audit trail of applied adjustments |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/learning/health` | GET | Component health status |
| `/api/v1/learning/rules` | GET | Active learned rules |
| `/api/v1/learning/errors` | GET | Recent forecast errors |
| `/api/v1/learning/explain/{id}` | GET | Explain forecast adjustments |
| `/api/v1/learning/analyze-error/{id}` | POST | Trigger LLM analysis |

## Safety Constraints

1. **Maximum Adjustment**: ±15% of base forecast
2. **Confidence Threshold**: Rules below 50% confidence not applied
3. **No Numerical Generation**: LLM outputs rules only, never values
4. **Audit Trail**: Every adjustment logged with explanation
5. **Feature Flags**: Adjustments can be disabled via config

## Configuration

Environment variables:
```
ENABLE_ADJUSTMENTS=true     # Enable/disable adjustment layer
ENABLE_LEARNING=true        # Enable/disable error learning
GOOGLE_GENERATIVE_AI_API_KEY=...  # Gemini API key
```

## Frontend Integration

The `AdjustmentExplanation` component displays:
- Whether forecast was adjusted
- Total adjustment percentage
- Applied rules with explanations
- Confidence indicators

## Testing

Run tests:
```bash
cd backend
pytest tests/test_learning_system.py -v
```

## Deployment Checklist

1. [ ] Run database migration
2. [ ] Set environment variables
3. [ ] Install new dependencies (`pip install -r requirements.txt`)
4. [ ] Start backend and verify `/api/v1/learning/health`
5. [ ] Monitor logs for learning loop activity
