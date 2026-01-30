-- =============================================================================
-- Powercast AI - Learning Memory Schema
-- Closed-Loop Context-Aware Self-Correcting Forecasting System
-- =============================================================================
-- Created: 2026-01-30
-- Description: Database schema for storing forecast events, errors, context
--              snapshots, generalized lessons, and rule applications.
-- =============================================================================

-- Enable pgvector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- FORECAST EVENTS: Immutable log of every forecast generated
-- =============================================================================
CREATE TABLE IF NOT EXISTS forecast_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_id TEXT NOT NULL UNIQUE,
    region_code TEXT NOT NULL,
    model_version TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    forecast_start TIMESTAMPTZ NOT NULL,
    horizon_hours INTEGER NOT NULL CHECK (horizon_hours > 0),
    
    -- Predictions stored as JSONB array
    -- Format: {timestamps: [], point: [], q10: [], q90: []}
    predictions JSONB NOT NULL,
    
    -- Input feature vector for reproducibility
    input_features JSONB,
    
    -- Additional metadata (model config, data source, etc.)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Indexes for common queries
    CONSTRAINT valid_predictions CHECK (
        predictions ? 'timestamps' AND predictions ? 'point'
    )
);

CREATE INDEX IF NOT EXISTS idx_forecast_events_region_time 
    ON forecast_events (region_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forecast_events_forecast_start 
    ON forecast_events (forecast_start);

-- =============================================================================
-- FORECAST ERRORS: Observed deviations between forecast and actual
-- =============================================================================
CREATE TABLE IF NOT EXISTS forecast_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_event_id UUID NOT NULL REFERENCES forecast_events(id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Error classification
    error_type TEXT NOT NULL CHECK (
        error_type IN ('mape_spike', 'peak_miss', 'ramp_error', 'bias', 'variance')
    ),
    severity TEXT NOT NULL CHECK (
        severity IN ('low', 'medium', 'high', 'critical')
    ),
    
    -- Error metrics
    mape FLOAT,                           -- Mean Absolute Percentage Error
    mae FLOAT,                            -- Mean Absolute Error (MW)
    peak_error_mw FLOAT,                  -- Peak timing/magnitude error
    ramp_error_mw_per_hour FLOAT,         -- Ramp rate error
    
    -- Actual values that revealed the error
    actual_values JSONB NOT NULL,
    
    -- Whether this error triggered context analysis
    analysis_triggered BOOLEAN DEFAULT FALSE,
    analysis_completed_at TIMESTAMPTZ,
    
    -- Additional context
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_forecast_errors_severity 
    ON forecast_errors (severity);
CREATE INDEX IF NOT EXISTS idx_forecast_errors_type_time 
    ON forecast_errors (error_type, observed_at DESC);

-- =============================================================================
-- CONTEXT SNAPSHOTS: RAG-indexed context at time of error
-- =============================================================================
CREATE TABLE IF NOT EXISTS context_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_error_id UUID NOT NULL REFERENCES forecast_errors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    region_code TEXT NOT NULL,
    
    -- Time window this context covers
    time_window_start TIMESTAMPTZ NOT NULL,
    time_window_end TIMESTAMPTZ NOT NULL,
    
    -- Weather context at time of error
    weather_context JSONB,
    -- Example: {temperature: 35, humidity: 40, condition: "heatwave", cloud_cover: 10}
    
    -- Grid notices, alerts, or events
    grid_notices JSONB,
    -- Example: [{type: "maintenance", message: "Line outage", severity: "medium"}]
    
    -- Policy or special events
    event_context JSONB,
    -- Example: {holidays: [], special_events: ["industrial_shutdown"]}
    
    -- Vector embedding for similarity search (Gemini text-embedding-004 = 768 dims)
    embedding vector(768),
    
    -- Human-readable summary for quick reference
    context_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_context_snapshots_region_time 
    ON context_snapshots (region_code, time_window_start DESC);
    
-- Vector similarity index for RAG queries
CREATE INDEX IF NOT EXISTS idx_context_snapshots_embedding 
    ON context_snapshots USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- =============================================================================
-- GENERALIZED LESSONS: LLM-extracted patterns from errors + context
-- =============================================================================
CREATE TABLE IF NOT EXISTS generalized_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_snapshot_id UUID NOT NULL REFERENCES context_snapshots(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- LLM-generated analysis
    failure_cause TEXT NOT NULL,
    -- Example: "Heatwave-induced early peak demand"
    
    -- Context signature for rule matching (array of tags)
    context_signature JSONB NOT NULL,
    -- Example: ["heatwave", "weekday", "solar_dip", "afternoon"]
    
    -- Generalized rule that can be applied to future forecasts
    generalized_rule TEXT NOT NULL,
    -- Example: "Increase evening ramp sensitivity by 10-15%"
    
    -- Suggested adjustment parameters
    adjustment_params JSONB DEFAULT '{}'::jsonb,
    -- Example: {adjustment_type: "ramp", direction: "up", magnitude_pct: 12}
    
    -- LLM confidence in this analysis (0.0 to 1.0)
    llm_confidence FLOAT NOT NULL CHECK (llm_confidence >= 0 AND llm_confidence <= 1),
    
    -- Lesson versioning (lessons can be refined over time)
    version INTEGER DEFAULT 1,
    
    -- Whether this lesson is currently active
    is_active BOOLEAN DEFAULT TRUE,
    
    -- How many times this lesson has been applied
    application_count INTEGER DEFAULT 0,
    
    -- Success rate when applied (updated after evaluation)
    success_rate FLOAT,
    
    -- Reason if deactivated
    deactivation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_lessons_active 
    ON generalized_lessons (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_lessons_confidence 
    ON generalized_lessons (llm_confidence DESC);

-- =============================================================================
-- RULE APPLICATIONS: Audit trail of every adjustment applied
-- =============================================================================
CREATE TABLE IF NOT EXISTS rule_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_event_id UUID NOT NULL REFERENCES forecast_events(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES generalized_lessons(id) ON DELETE CASCADE,
    applied_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Before/after comparison for specific prediction points
    prediction_index INTEGER,             -- Which prediction step was adjusted
    original_prediction FLOAT NOT NULL,
    adjusted_prediction FLOAT NOT NULL,
    adjustment_factor FLOAT NOT NULL,     -- e.g., 1.12 for +12%
    
    -- Confidence of the match between current context and lesson
    match_confidence FLOAT NOT NULL CHECK (match_confidence >= 0 AND match_confidence <= 1),
    
    -- Human-readable explanation of why this rule was applied
    explanation TEXT NOT NULL,
    
    -- Context at time of application (for debugging)
    current_context JSONB,
    
    -- Post-verification (filled in after actual values are known)
    was_beneficial BOOLEAN,
    benefit_score FLOAT
);

CREATE INDEX IF NOT EXISTS idx_rule_applications_forecast 
    ON rule_applications (forecast_event_id);
CREATE INDEX IF NOT EXISTS idx_rule_applications_lesson 
    ON rule_applications (lesson_id);

-- =============================================================================
-- VIEWS: Convenient aggregations
-- =============================================================================

-- Active lessons with application statistics
CREATE OR REPLACE VIEW active_lessons_with_stats AS
SELECT 
    gl.id,
    gl.failure_cause,
    gl.context_signature,
    gl.generalized_rule,
    gl.llm_confidence,
    gl.application_count,
    gl.success_rate,
    gl.created_at,
    COUNT(ra.id) as recent_applications,
    AVG(ra.benefit_score) as avg_benefit_score
FROM generalized_lessons gl
LEFT JOIN rule_applications ra ON gl.id = ra.lesson_id 
    AND ra.applied_at > now() - INTERVAL '7 days'
WHERE gl.is_active = TRUE
GROUP BY gl.id;

-- Error frequency by type and region
CREATE OR REPLACE VIEW error_frequency AS
SELECT 
    fe.region_code,
    fer.error_type,
    fer.severity,
    COUNT(*) as error_count,
    AVG(fer.mape) as avg_mape,
    MAX(fer.observed_at) as last_occurrence
FROM forecast_errors fer
JOIN forecast_events fe ON fer.forecast_event_id = fe.id
WHERE fer.observed_at > now() - INTERVAL '30 days'
GROUP BY fe.region_code, fer.error_type, fer.severity
ORDER BY error_count DESC;

-- =============================================================================
-- FUNCTIONS: Helper functions for learning loop
-- =============================================================================

-- Function to find similar contexts using vector similarity
CREATE OR REPLACE FUNCTION find_similar_contexts(
    query_embedding vector(768),
    match_region TEXT,
    match_count INTEGER DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    snapshot_id UUID,
    lesson_id UUID,
    failure_cause TEXT,
    context_signature JSONB,
    generalized_rule TEXT,
    similarity FLOAT,
    llm_confidence FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id as snapshot_id,
        gl.id as lesson_id,
        gl.failure_cause,
        gl.context_signature,
        gl.generalized_rule,
        (1 - (cs.embedding <=> query_embedding))::FLOAT as similarity,
        gl.llm_confidence
    FROM context_snapshots cs
    JOIN generalized_lessons gl ON gl.context_snapshot_id = cs.id
    WHERE cs.region_code = match_region
        AND gl.is_active = TRUE
        AND (1 - (cs.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY cs.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update lesson success rate after evaluation
CREATE OR REPLACE FUNCTION update_lesson_success_rate(lesson_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE generalized_lessons
    SET 
        success_rate = (
            SELECT AVG(CASE WHEN was_beneficial THEN 1.0 ELSE 0.0 END)
            FROM rule_applications
            WHERE lesson_id = lesson_uuid AND was_beneficial IS NOT NULL
        ),
        application_count = (
            SELECT COUNT(*)
            FROM rule_applications
            WHERE lesson_id = lesson_uuid
        )
    WHERE id = lesson_uuid;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY (Optional - enable for multi-tenancy)
-- =============================================================================

-- For now, these tables are internal to the system and don't need RLS.
-- Add if needed for multi-tenant deployment.

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE forecast_events IS 'Immutable log of every forecast generated by the system';
COMMENT ON TABLE forecast_errors IS 'Detected deviations between forecasts and actual values';
COMMENT ON TABLE context_snapshots IS 'RAG-indexed context at the time of significant errors';
COMMENT ON TABLE generalized_lessons IS 'LLM-extracted patterns and rules from error analysis';
COMMENT ON TABLE rule_applications IS 'Audit trail of every adjustment applied to forecasts';
