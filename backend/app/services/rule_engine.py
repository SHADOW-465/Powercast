"""
Powercast AI - Rule Engine
Safe, explainable rule application for forecast adjustments.

CRITICAL CONSTRAINTS:
1. Never apply adjustments > ±15% of base forecast
2. Always log every rule application with full explanation
3. Never override base model output blindly
4. Confidence-weighted blending for multiple rules
5. All adjustments must be auditable and reversible
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION
# =============================================================================

# Maximum allowed adjustment (safety limit)
MAX_ADJUSTMENT_PCT = 15.0

# Minimum confidence to apply a rule
MIN_RULE_CONFIDENCE = 0.5

# Minimum context similarity to consider a rule applicable
MIN_SIMILARITY_THRESHOLD = 0.6


# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class ApplicableRule:
    """A rule that may apply to the current forecast context."""
    lesson_id: str
    failure_cause: str
    context_signature: List[str]
    generalized_rule: str
    adjustment_type: str  # ramp, peak, bias, variance, scale
    direction: str  # up, down
    magnitude_pct: float
    llm_confidence: float
    context_similarity: float
    
    @property
    def effective_weight(self) -> float:
        """Calculate effective weight for blending (confidence * similarity)."""
        return self.llm_confidence * self.context_similarity
    
    @property
    def effective_adjustment(self) -> float:
        """Calculate effective adjustment factor."""
        # Clamp to max allowed
        magnitude = min(self.magnitude_pct, MAX_ADJUSTMENT_PCT)
        
        # Apply direction
        if self.direction == "down":
            magnitude = -magnitude
        
        # Weight by confidence and similarity
        return magnitude * self.effective_weight


@dataclass
class RuleApplication:
    """Record of a rule being applied to a forecast."""
    forecast_event_id: str
    lesson_id: str
    prediction_index: int
    original_prediction: float
    adjusted_prediction: float
    adjustment_factor: float
    match_confidence: float
    explanation: str
    current_context: Optional[Dict[str, Any]] = None
    
    def to_db_dict(self) -> Dict[str, Any]:
        """Convert to database-ready dictionary."""
        return {
            "forecast_event_id": self.forecast_event_id,
            "lesson_id": self.lesson_id,
            "prediction_index": self.prediction_index,
            "original_prediction": self.original_prediction,
            "adjusted_prediction": self.adjusted_prediction,
            "adjustment_factor": self.adjustment_factor,
            "match_confidence": self.match_confidence,
            "explanation": self.explanation,
            "current_context": self.current_context,
        }


@dataclass
class AdjustmentResult:
    """Result of applying rules to a forecast."""
    adjusted_predictions: List[float]
    original_predictions: List[float]
    applied_rules: List[RuleApplication]
    total_adjustment_pct: float
    explanation: str
    confidence: float


# =============================================================================
# RULE ENGINE SERVICE
# =============================================================================

class RuleEngine:
    """
    Engine for matching and applying learned rules to forecasts.
    
    Ensures safe, explainable, and auditable adjustments.
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._supabase = None
        self._initialized = True
        
        self._init_database()
    
    def _init_database(self):
        """Initialize Supabase connection."""
        try:
            from app.core.supabase import get_supabase_admin
            self._supabase = get_supabase_admin()
            if self._supabase:
                logger.info("RuleEngine: Connected to Supabase")
        except Exception as e:
            logger.warning(f"RuleEngine: Could not connect to database: {e}")
    
    def match_rules(
        self,
        current_context: Dict[str, Any],
        similar_contexts: List[Any],  # List of SimilarContext from context_engine
    ) -> List[ApplicableRule]:
        """
        Find rules that apply to the current context.
        
        Args:
            current_context: Current weather/event context
            similar_contexts: Results from context engine similarity search
            
        Returns:
            List of applicable rules sorted by effective weight
        """
        applicable_rules = []
        
        for similar in similar_contexts:
            # Skip if no lesson attached or below threshold
            if not similar.lesson_id:
                continue
            if similar.similarity < MIN_SIMILARITY_THRESHOLD:
                continue
            if similar.llm_confidence and similar.llm_confidence < MIN_RULE_CONFIDENCE:
                continue
            
            # Fetch full lesson details
            lesson = self._get_lesson(similar.lesson_id)
            if not lesson or not lesson.get("is_active"):
                continue
            
            # Extract adjustment params
            adj_params = lesson.get("adjustment_params", {})
            
            rule = ApplicableRule(
                lesson_id=similar.lesson_id,
                failure_cause=similar.failure_cause or lesson.get("failure_cause", "Unknown"),
                context_signature=similar.context_signature or [],
                generalized_rule=similar.generalized_rule or lesson.get("generalized_rule", ""),
                adjustment_type=adj_params.get("adjustment_type", "scale"),
                direction=adj_params.get("direction", "up"),
                magnitude_pct=adj_params.get("magnitude_pct", 5.0),
                llm_confidence=similar.llm_confidence or 0.5,
                context_similarity=similar.similarity,
            )
            
            applicable_rules.append(rule)
        
        # Sort by effective weight (highest first)
        applicable_rules.sort(key=lambda r: r.effective_weight, reverse=True)
        
        return applicable_rules
    
    def _get_lesson(self, lesson_id: str) -> Optional[Dict[str, Any]]:
        """Fetch lesson details from database."""
        if not self._supabase:
            return None
        
        try:
            result = (
                self._supabase.table("generalized_lessons")
                .select("*")
                .eq("id", lesson_id)
                .single()
                .execute()
            )
            return result.data
        except Exception as e:
            logger.error(f"Failed to fetch lesson {lesson_id}: {e}")
            return None
    
    def apply_rules(
        self,
        predictions: List[float],
        applicable_rules: List[ApplicableRule],
        forecast_event_id: str,
        current_context: Optional[Dict[str, Any]] = None,
    ) -> AdjustmentResult:
        """
        Apply matching rules to forecast predictions.
        
        Args:
            predictions: Original point predictions
            applicable_rules: Rules to consider applying
            forecast_event_id: ID of the forecast event
            current_context: Current context for logging
            
        Returns:
            AdjustmentResult with adjusted predictions and audit trail
        """
        if not applicable_rules:
            return AdjustmentResult(
                adjusted_predictions=predictions.copy(),
                original_predictions=predictions.copy(),
                applied_rules=[],
                total_adjustment_pct=0.0,
                explanation="No applicable rules found",
                confidence=1.0,  # High confidence in base forecast
            )
        
        # Calculate blended adjustment
        blended_adjustment, applied_rules = self._blend_adjustments(
            predictions,
            applicable_rules,
            forecast_event_id,
            current_context,
        )
        
        # Apply adjustment to predictions
        adjusted_predictions = []
        adjustment_factor = 1.0 + (blended_adjustment / 100.0)
        
        for i, pred in enumerate(predictions):
            adjusted = pred * adjustment_factor
            adjusted_predictions.append(adjusted)
        
        # Generate explanation
        explanation = self._generate_explanation(applied_rules, blended_adjustment)
        
        # Calculate overall confidence
        avg_confidence = sum(r.effective_weight for r in applicable_rules) / len(applicable_rules)
        
        # Store rule applications
        for app in applied_rules:
            self._store_application(app)
        
        return AdjustmentResult(
            adjusted_predictions=adjusted_predictions,
            original_predictions=predictions.copy(),
            applied_rules=applied_rules,
            total_adjustment_pct=blended_adjustment,
            explanation=explanation,
            confidence=avg_confidence,
        )
    
    def _blend_adjustments(
        self,
        predictions: List[float],
        rules: List[ApplicableRule],
        forecast_event_id: str,
        current_context: Optional[Dict[str, Any]],
    ) -> Tuple[float, List[RuleApplication]]:
        """
        Blend multiple rule adjustments using weighted average.
        
        Returns:
            Tuple of (blended adjustment percentage, list of applications)
        """
        applications = []
        total_weight = 0.0
        weighted_adjustment = 0.0
        
        for rule in rules:
            weight = rule.effective_weight
            adjustment = rule.effective_adjustment
            
            weighted_adjustment += adjustment * weight
            total_weight += weight
            
            # Create application record (using first prediction as example)
            example_pred = predictions[0] if predictions else 0.0
            factor = 1.0 + (adjustment / 100.0)
            
            app = RuleApplication(
                forecast_event_id=forecast_event_id,
                lesson_id=rule.lesson_id,
                prediction_index=0,  # Representative
                original_prediction=example_pred,
                adjusted_prediction=example_pred * factor,
                adjustment_factor=factor,
                match_confidence=rule.effective_weight,
                explanation=f"Applied '{rule.generalized_rule}' due to {', '.join(rule.context_signature)}",
                current_context=current_context,
            )
            applications.append(app)
        
        if total_weight > 0:
            blended = weighted_adjustment / total_weight
        else:
            blended = 0.0
        
        # Clamp to max allowed
        blended = max(-MAX_ADJUSTMENT_PCT, min(MAX_ADJUSTMENT_PCT, blended))
        
        return blended, applications
    
    def _generate_explanation(
        self,
        applications: List[RuleApplication],
        total_adjustment: float,
    ) -> str:
        """Generate human-readable explanation of adjustments."""
        if not applications:
            return "No adjustments applied."
        
        parts = [f"Applied {len(applications)} rule(s), total adjustment: {total_adjustment:+.1f}%"]
        
        for app in applications[:3]:  # Limit to top 3
            parts.append(f"• {app.explanation}")
        
        if len(applications) > 3:
            parts.append(f"  (and {len(applications) - 3} more...)")
        
        return "\n".join(parts)
    
    def _store_application(self, application: RuleApplication):
        """Store rule application in database for audit."""
        if not self._supabase:
            logger.info(f"[FALLBACK] Rule applied: {application.explanation}")
            return
        
        try:
            self._supabase.table("rule_applications").insert(
                application.to_db_dict()
            ).execute()
            
            # Update lesson application count
            self._supabase.rpc(
                "update_lesson_success_rate",
                {"lesson_uuid": application.lesson_id}
            ).execute()
            
        except Exception as e:
            logger.error(f"Failed to store rule application: {e}")
    
    def update_rule_outcome(
        self,
        application_id: str,
        was_beneficial: bool,
        benefit_score: float,
    ):
        """
        Update a rule application with its outcome.
        
        Called after actual values are known to track rule success.
        """
        if not self._supabase:
            return
        
        try:
            self._supabase.table("rule_applications").update(
                {
                    "was_beneficial": was_beneficial,
                    "benefit_score": benefit_score,
                }
            ).eq("id", application_id).execute()
            
        except Exception as e:
            logger.error(f"Failed to update rule outcome: {e}")
    
    def get_active_rules_summary(self, region_code: str) -> Dict[str, Any]:
        """Get summary of active rules for a region."""
        if not self._supabase:
            return {"rules_count": 0, "rules": []}
        
        try:
            result = (
                self._supabase.table("active_lessons_with_stats")
                .select("*")
                .execute()
            )
            
            rules = result.data or []
            
            return {
                "rules_count": len(rules),
                "rules": [
                    {
                        "id": r["id"],
                        "failure_cause": r["failure_cause"],
                        "generalized_rule": r["generalized_rule"],
                        "confidence": r["llm_confidence"],
                        "application_count": r["application_count"],
                        "success_rate": r["success_rate"],
                    }
                    for r in rules[:10]
                ],
            }
        except Exception as e:
            logger.error(f"Failed to get rules summary: {e}")
            return {"rules_count": 0, "rules": []}


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_rule_engine: Optional[RuleEngine] = None


def get_rule_engine() -> RuleEngine:
    """Get or create the rule engine singleton."""
    global _rule_engine
    if _rule_engine is None:
        _rule_engine = RuleEngine()
    return _rule_engine
