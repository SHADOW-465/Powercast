"""
Tests for the Closed-Loop Learning System
Unit tests for rule logic, error detection, and adjustment boundaries.
"""

import pytest
import numpy as np
from datetime import datetime
from unittest.mock import Mock, patch

# Import modules under test
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.error_observer import (
    ErrorObserver,
    ErrorType,
    ErrorSeverity,
    ForecastError,
    ErrorThresholds,
)
from app.services.rule_engine import (
    RuleEngine,
    ApplicableRule,
    AdjustmentResult,
    MAX_ADJUSTMENT_PCT,
)
from app.services.llm_reasoning import (
    LLMAnalysisResult,
    AdjustmentParams,
)


# =============================================================================
# ERROR OBSERVER TESTS
# =============================================================================

class TestErrorObserver:
    """Tests for the error detection and classification system."""
    
    def test_mape_classification_low(self):
        """MAPE under 5% should be LOW severity."""
        observer = ErrorObserver(thresholds=ErrorThresholds())
        severity = observer._get_mape_severity(4.5)
        assert severity == ErrorSeverity.LOW
    
    def test_mape_classification_medium(self):
        """MAPE 10-15% should be MEDIUM severity."""
        observer = ErrorObserver()
        severity = observer._get_mape_severity(12.0)
        assert severity == ErrorSeverity.MEDIUM
    
    def test_mape_classification_high(self):
        """MAPE 15-25% should be HIGH severity."""
        observer = ErrorObserver()
        severity = observer._get_mape_severity(18.0)
        assert severity == ErrorSeverity.HIGH
    
    def test_mape_classification_critical(self):
        """MAPE over 25% should be CRITICAL severity."""
        observer = ErrorObserver()
        severity = observer._get_mape_severity(30.0)
        assert severity == ErrorSeverity.CRITICAL
    
    def test_error_analysis_empty_data(self):
        """Should handle empty prediction/actual arrays gracefully."""
        observer = ErrorObserver()
        errors = observer.analyze_forecast(
            forecast_event_id="test_123",
            predictions={"point": [], "timestamps": []},
            actuals={"values": []},
        )
        assert errors == []
    
    def test_error_analysis_detects_mape_spike(self):
        """Should detect MAPE spike when predictions differ significantly."""
        observer = ErrorObserver()
        
        predictions = {
            "point": [100, 100, 100, 100, 100],
            "timestamps": ["t1", "t2", "t3", "t4", "t5"],
        }
        actuals = {
            "values": [120, 125, 115, 130, 140],  # ~25% error
        }
        
        errors = observer.analyze_forecast(
            forecast_event_id="test_mape",
            predictions=predictions,
            actuals=actuals,
        )
        
        mape_errors = [e for e in errors if e.error_type == ErrorType.MAPE_SPIKE]
        assert len(mape_errors) >= 1
        assert mape_errors[0].severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]
    
    def test_peak_miss_detection(self):
        """Should detect when predicted peak differs from actual."""
        observer = ErrorObserver()
        
        # Peak at different times and magnitudes
        predictions = {
            "point": [100, 200, 500, 300, 100],  # Peak at index 2 = 500
            "timestamps": ["t1", "t2", "t3", "t4", "t5"],
        }
        actuals = {
            "values": [100, 150, 200, 300, 800],  # Peak at index 4 = 800
        }
        
        errors = observer.analyze_forecast(
            forecast_event_id="test_peak",
            predictions=predictions,
            actuals=actuals,
        )
        
        peak_errors = [e for e in errors if e.error_type == ErrorType.PEAK_MISS]
        assert len(peak_errors) >= 1


# =============================================================================
# RULE ENGINE TESTS
# =============================================================================

class TestRuleEngine:
    """Tests for the rule matching and adjustment logic."""
    
    def test_max_adjustment_limit(self):
        """Adjustments should never exceed ±15%."""
        assert MAX_ADJUSTMENT_PCT == 15.0
    
    def test_no_rules_returns_original(self):
        """When no rules apply, should return original predictions unchanged."""
        engine = RuleEngine()
        
        predictions = [100.0, 200.0, 300.0]
        result = engine.apply_rules(
            predictions=predictions,
            applicable_rules=[],
            forecast_event_id="test_empty",
        )
        
        assert result.adjusted_predictions == predictions
        assert result.total_adjustment_pct == 0.0
        assert len(result.applied_rules) == 0
    
    def test_single_rule_applies_adjustment(self):
        """Single rule should apply its adjustment factor."""
        engine = RuleEngine()
        
        rule = ApplicableRule(
            lesson_id="lesson_001",
            failure_cause="Test cause",
            context_signature=["test"],
            generalized_rule="Test rule",
            adjustment_type="scale",
            direction="up",
            magnitude_pct=10.0,
            llm_confidence=1.0,
            context_similarity=1.0,
        )
        
        predictions = [100.0, 100.0, 100.0]
        result = engine.apply_rules(
            predictions=predictions,
            applicable_rules=[rule],
            forecast_event_id="test_single",
        )
        
        # With 100% confidence and similarity, should apply full 10%
        expected = [110.0, 110.0, 110.0]
        assert all(
            abs(a - e) < 0.01 
            for a, e in zip(result.adjusted_predictions, expected)
        )
    
    def test_adjustment_capped_at_max(self):
        """Even if rule suggests more, adjustment should cap at 15%."""
        engine = RuleEngine()
        
        # Rule suggesting 20% (above max)
        rule = ApplicableRule(
            lesson_id="lesson_over",
            failure_cause="Test",
            context_signature=["test"],
            generalized_rule="Test",
            adjustment_type="scale",
            direction="up",
            magnitude_pct=20.0,  # Above 15% cap
            llm_confidence=1.0,
            context_similarity=1.0,
        )
        
        predictions = [100.0]
        result = engine.apply_rules(
            predictions=predictions,
            applicable_rules=[rule],
            forecast_event_id="test_cap",
        )
        
        # Should cap at 15%
        assert result.adjusted_predictions[0] <= 115.01
    
    def test_confidence_weighting(self):
        """Lower confidence should reduce effective adjustment."""
        engine = RuleEngine()
        
        rule = ApplicableRule(
            lesson_id="lesson_low_conf",
            failure_cause="Test",
            context_signature=["test"],
            generalized_rule="Test",
            adjustment_type="scale",
            direction="up",
            magnitude_pct=10.0,
            llm_confidence=0.5,  # 50% confidence
            context_similarity=1.0,
        )
        
        predictions = [100.0]
        result = engine.apply_rules(
            predictions=predictions,
            applicable_rules=[rule],
            forecast_event_id="test_conf",
        )
        
        # 10% * 0.5 * 1.0 = 5% effective
        assert result.adjusted_predictions[0] == pytest.approx(105.0, rel=0.01)


# =============================================================================
# LLM OUTPUT VALIDATION TESTS
# =============================================================================

class TestLLMOutputValidation:
    """Tests for LLM output schema validation."""
    
    def test_valid_adjustment_params(self):
        """Valid adjustment params should pass validation."""
        params = AdjustmentParams(
            adjustment_type="ramp",
            direction="up",
            magnitude_pct=10.0,
        )
        assert params.validate() == True
    
    def test_invalid_adjustment_type(self):
        """Invalid adjustment type should fail validation."""
        params = AdjustmentParams(
            adjustment_type="invalid_type",
            direction="up",
            magnitude_pct=10.0,
        )
        assert params.validate() == False
    
    def test_invalid_direction(self):
        """Invalid direction should fail validation."""
        params = AdjustmentParams(
            adjustment_type="scale",
            direction="sideways",
            magnitude_pct=10.0,
        )
        assert params.validate() == False
    
    def test_magnitude_over_limit(self):
        """Magnitude over 15% should fail validation."""
        params = AdjustmentParams(
            adjustment_type="scale",
            direction="up",
            magnitude_pct=20.0,  # Over 15% limit
        )
        assert params.validate() == False
    
    def test_negative_magnitude(self):
        """Negative magnitude should fail validation."""
        params = AdjustmentParams(
            adjustment_type="scale",
            direction="up",
            magnitude_pct=-5.0,
        )
        assert params.validate() == False
    
    def test_full_analysis_result_validation(self):
        """Full analysis result should validate all components."""
        analysis = LLMAnalysisResult(
            failure_cause="Heatwave caused early peak",
            context_signature=["heatwave", "afternoon"],
            generalized_rule="Increase afternoon ramp by 10%",
            adjustment_params=AdjustmentParams(
                adjustment_type="ramp",
                direction="up",
                magnitude_pct=10.0,
            ),
            confidence=0.85,
        )
        assert analysis.validate() == True
    
    def test_analysis_empty_signature_fails(self):
        """Empty context signature should fail."""
        analysis = LLMAnalysisResult(
            failure_cause="Test cause",
            context_signature=[],  # Empty
            generalized_rule="Test rule that is long enough",
            adjustment_params=AdjustmentParams("scale", "up", 5.0),
            confidence=0.5,
        )
        assert analysis.validate() == False


# =============================================================================
# INTEGRATION TESTS
# =============================================================================

class TestLearningLoopIntegration:
    """Integration tests for the full learning loop."""
    
    @pytest.mark.skip(reason="Requires database connection")
    def test_forecast_logged_after_prediction(self):
        """Forecasts should be logged to the database."""
        pass
    
    @pytest.mark.skip(reason="Requires database connection")
    def test_error_triggers_analysis(self):
        """High severity errors should trigger LLM analysis."""
        pass
    
    @pytest.mark.skip(reason="Requires Gemini API")
    def test_llm_generates_valid_lesson(self):
        """LLM should generate valid, parseable lessons."""
        pass


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
