"""
Powercast AI - LLM Reasoning Layer
Gemini-powered structured analysis of forecast errors and context.

STRICT RULES:
1. LLM outputs ONLY structured JSON analysis
2. LLM NEVER generates numerical forecasts
3. All outputs are validated against schema
4. Non-JSON outputs are rejected and retried

Output Schema:
{
    "failure_cause": "Human-readable cause description",
    "context_signature": ["tag1", "tag2", ...],  // Matchable context tags
    "generalized_rule": "Actionable adjustment rule",
    "adjustment_params": {
        "adjustment_type": "ramp|peak|bias|variance",
        "direction": "up|down",
        "magnitude_pct": 0-15  // Max 15% adjustment
    },
    "confidence": 0.0-1.0
}
"""

import logging
import json
import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


# =============================================================================
# OUTPUT SCHEMA
# =============================================================================

@dataclass
class AdjustmentParams:
    """Parameters for forecast adjustment."""
    adjustment_type: str  # ramp, peak, bias, variance
    direction: str  # up, down
    magnitude_pct: float  # 0-15%
    
    def validate(self) -> bool:
        """Validate adjustment parameters."""
        valid_types = ["ramp", "peak", "bias", "variance", "scale"]
        valid_directions = ["up", "down"]
        
        if self.adjustment_type not in valid_types:
            return False
        if self.direction not in valid_directions:
            return False
        if not (0 <= self.magnitude_pct <= 15):
            return False
        return True


@dataclass
class LLMAnalysisResult:
    """Structured output from LLM analysis."""
    failure_cause: str
    context_signature: List[str]
    generalized_rule: str
    adjustment_params: AdjustmentParams
    confidence: float
    
    def validate(self) -> bool:
        """Validate the analysis result."""
        if not self.failure_cause or len(self.failure_cause) < 10:
            return False
        if not self.context_signature or len(self.context_signature) == 0:
            return False
        if not self.generalized_rule or len(self.generalized_rule) < 10:
            return False
        if not (0 <= self.confidence <= 1):
            return False
        if not self.adjustment_params.validate():
            return False
        return True
    
    def to_db_dict(self) -> Dict[str, Any]:
        """Convert to database-ready dictionary."""
        return {
            "failure_cause": self.failure_cause,
            "context_signature": self.context_signature,
            "generalized_rule": self.generalized_rule,
            "adjustment_params": asdict(self.adjustment_params),
            "llm_confidence": self.confidence,
        }


# =============================================================================
# PROMPT TEMPLATES
# =============================================================================

ANALYSIS_PROMPT = """You are an expert power grid forecast analyst. Analyze this forecast error and context to identify the root cause and suggest a corrective rule.

## FORECAST ERROR
- Error Type: {error_type}
- Severity: {severity}
- MAPE: {mape}%
- Peak Error: {peak_error_mw} MW
- Ramp Error: {ramp_error} MW/hour
- Region: {region_code}
- Error Time: {error_time}

## CONTEXT AT TIME OF ERROR
{context_summary}

### Weather Context:
{weather_context}

### Grid Notices:
{grid_notices}

### Event Context:
{event_context}

## SIMILAR HISTORICAL ERRORS (for reference)
{similar_errors}

## YOUR TASK
Analyze why this forecast failed and create a generalized rule that can prevent similar failures in the future.

CRITICAL CONSTRAINTS:
1. Do NOT suggest numerical forecast values
2. Adjustment magnitude must be between 0-15%
3. Be specific about the context conditions that trigger this rule
4. The rule must be actionable for an automated system

## REQUIRED OUTPUT FORMAT (JSON ONLY)
You MUST respond with ONLY valid JSON in this exact format:
```json
{{
    "failure_cause": "Clear explanation of what caused the forecast error",
    "context_signature": ["tag1", "tag2", "tag3"],
    "generalized_rule": "When [conditions], adjust [what] by [how much] because [why]",
    "adjustment_params": {{
        "adjustment_type": "ramp|peak|bias|variance|scale",
        "direction": "up|down",
        "magnitude_pct": 5
    }},
    "confidence": 0.75
}}
```

Context signature tags should be from: heatwave, cold_snap, weekday, weekend, morning, afternoon, evening, night, holiday, solar_dip, solar_peak, wind_high, wind_low, overcast, clear_sky, maintenance, grid_stress

DO NOT include any text before or after the JSON object.
"""


# =============================================================================
# LLM REASONING SERVICE
# =============================================================================

class LLMReasoningService:
    """
    Service for generating structured analysis using Gemini.
    
    Ensures all outputs are valid JSON conforming to the analysis schema.
    Retries on invalid outputs, falls back to conservative defaults.
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
        
        self._genai = None
        self._model = None
        self._max_retries = 3
        self._initialized = True
        
        self._init_gemini()
    
    def _init_gemini(self):
        """Initialize Gemini API."""
        try:
            import google.generativeai as genai
            api_key = os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
            if api_key:
                genai.configure(api_key=api_key)
                self._genai = genai
                self._model = genai.GenerativeModel(
                    model_name="gemini-2.0-flash",
                    generation_config={
                        "temperature": 0.2,  # Low temperature for consistency
                        "top_p": 0.8,
                        "max_output_tokens": 1024,
                    }
                )
                logger.info("LLMReasoningService: Gemini model initialized")
            else:
                logger.warning("LLMReasoningService: GOOGLE_GENERATIVE_AI_API_KEY not set")
        except Exception as e:
            logger.error(f"LLMReasoningService: Failed to initialize Gemini: {e}")
    
    async def analyze_error(
        self,
        error_type: str,
        severity: str,
        region_code: str,
        error_time: datetime,
        mape: Optional[float] = None,
        peak_error_mw: Optional[float] = None,
        ramp_error: Optional[float] = None,
        context_summary: str = "",
        weather_context: Optional[Dict[str, Any]] = None,
        grid_notices: Optional[List[Dict[str, Any]]] = None,
        event_context: Optional[Dict[str, Any]] = None,
        similar_errors: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[LLMAnalysisResult]:
        """
        Analyze a forecast error and generate a corrective rule.
        
        Args:
            error_type: Type of error (mape_spike, peak_miss, etc.)
            severity: Error severity level
            region_code: Region where error occurred
            error_time: When the error occurred
            mape: Mean Absolute Percentage Error (if applicable)
            peak_error_mw: Peak error magnitude (if applicable)
            ramp_error: Ramp rate error (if applicable)
            context_summary: Human-readable context summary
            weather_context: Weather conditions at error time
            grid_notices: Any grid notices/alerts
            event_context: Holidays, special events, etc.
            similar_errors: Historical similar errors for reference
            
        Returns:
            LLMAnalysisResult or None if analysis failed
        """
        if not self._model:
            logger.warning("Gemini model not available, using fallback analysis")
            return self._generate_fallback_analysis(error_type, severity, weather_context)
        
        # Format the prompt
        prompt = ANALYSIS_PROMPT.format(
            error_type=error_type,
            severity=severity,
            mape=mape or "N/A",
            peak_error_mw=peak_error_mw or "N/A",
            ramp_error=ramp_error or "N/A",
            region_code=region_code,
            error_time=error_time.isoformat() if error_time else "Unknown",
            context_summary=context_summary or "No context available",
            weather_context=json.dumps(weather_context or {}, indent=2),
            grid_notices=json.dumps(grid_notices or [], indent=2),
            event_context=json.dumps(event_context or {}, indent=2),
            similar_errors=self._format_similar_errors(similar_errors),
        )
        
        # Try to get valid JSON response
        for attempt in range(self._max_retries):
            try:
                response = await self._model.generate_content_async(prompt)
                result = self._parse_response(response.text)
                
                if result and result.validate():
                    logger.info(f"LLM analysis successful: {result.failure_cause[:50]}...")
                    return result
                else:
                    logger.warning(f"Invalid LLM response on attempt {attempt + 1}")
                    
            except Exception as e:
                logger.error(f"LLM generation failed on attempt {attempt + 1}: {e}")
        
        # All retries failed, use fallback
        logger.warning("All LLM attempts failed, using fallback analysis")
        return self._generate_fallback_analysis(error_type, severity, weather_context)
    
    def _parse_response(self, response_text: str) -> Optional[LLMAnalysisResult]:
        """Parse LLM response and extract JSON."""
        try:
            # Try to find JSON in the response
            text = response_text.strip()
            
            # Remove markdown code blocks if present
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            
            text = text.strip()
            
            # Parse JSON
            data = json.loads(text)
            
            # Extract adjustment params
            adj_params = data.get("adjustment_params", {})
            adjustment = AdjustmentParams(
                adjustment_type=adj_params.get("adjustment_type", "scale"),
                direction=adj_params.get("direction", "up"),
                magnitude_pct=float(adj_params.get("magnitude_pct", 5)),
            )
            
            return LLMAnalysisResult(
                failure_cause=data.get("failure_cause", ""),
                context_signature=data.get("context_signature", []),
                generalized_rule=data.get("generalized_rule", ""),
                adjustment_params=adjustment,
                confidence=float(data.get("confidence", 0.5)),
            )
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from LLM response: {e}")
            return None
        except Exception as e:
            logger.error(f"Error parsing LLM response: {e}")
            return None
    
    def _format_similar_errors(self, similar_errors: Optional[List[Dict[str, Any]]]) -> str:
        """Format similar errors for the prompt."""
        if not similar_errors:
            return "No similar historical errors found."
        
        parts = []
        for i, err in enumerate(similar_errors[:3], 1):
            parts.append(f"{i}. {err.get('failure_cause', 'Unknown cause')}")
            if err.get('generalized_rule'):
                parts.append(f"   Rule: {err['generalized_rule']}")
        
        return "\n".join(parts)
    
    def _generate_fallback_analysis(
        self,
        error_type: str,
        severity: str,
        weather_context: Optional[Dict[str, Any]] = None,
    ) -> LLMAnalysisResult:
        """Generate conservative fallback analysis when LLM is unavailable."""
        # Determine adjustment based on error type
        adjustment_map = {
            "mape_spike": ("scale", "up", 5),
            "peak_miss": ("peak", "up", 8),
            "ramp_error": ("ramp", "up", 6),
            "bias": ("bias", "up", 4),
            "variance": ("variance", "up", 5),
        }
        
        adj_type, direction, magnitude = adjustment_map.get(
            error_type, ("scale", "up", 5)
        )
        
        # Build context signature from weather
        signature = [error_type]
        if weather_context:
            condition = weather_context.get("condition", "")
            if "heatwave" in condition:
                signature.append("heatwave")
            if "cold" in condition:
                signature.append("cold_snap")
        
        return LLMAnalysisResult(
            failure_cause=f"Fallback analysis: {error_type} detected with {severity} severity",
            context_signature=signature,
            generalized_rule=f"When similar conditions occur, apply {magnitude}% {direction}ward {adj_type} adjustment",
            adjustment_params=AdjustmentParams(
                adjustment_type=adj_type,
                direction=direction,
                magnitude_pct=magnitude,
            ),
            confidence=0.5,  # Lower confidence for fallback
        )
    
    async def store_lesson(
        self,
        context_snapshot_id: str,
        analysis: LLMAnalysisResult,
    ) -> Optional[str]:
        """
        Store the analysis result as a generalized lesson.
        
        Args:
            context_snapshot_id: UUID of the context snapshot
            analysis: The LLM analysis result
            
        Returns:
            UUID of the created lesson or None
        """
        try:
            from app.core.supabase import get_supabase_admin
            supabase = get_supabase_admin()
            
            if not supabase:
                logger.warning("Supabase not available to store lesson")
                return None
            
            data = analysis.to_db_dict()
            data["context_snapshot_id"] = context_snapshot_id
            
            result = supabase.table("generalized_lessons").insert(data).execute()
            
            if result.data:
                lesson_id = result.data[0]["id"]
                logger.info(f"Stored lesson: {lesson_id}")
                return lesson_id
            
        except Exception as e:
            logger.error(f"Failed to store lesson: {e}")
        
        return None
    
    def health_check(self) -> Dict[str, Any]:
        """Check LLM service health."""
        return {
            "gemini_available": self._model is not None,
            "model_name": "gemini-2.0-flash" if self._model else None,
            "max_retries": self._max_retries,
            "status": "healthy" if self._model else "degraded",
        }


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_llm_service: Optional[LLMReasoningService] = None


def get_llm_reasoning_service() -> LLMReasoningService:
    """Get or create the LLM reasoning service singleton."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMReasoningService()
    return _llm_service
