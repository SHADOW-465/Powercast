-- Model Registry Table
-- Stores metadata for all trained regional XGBoost models

CREATE TABLE IF NOT EXISTS model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Region identification
    region_code TEXT UNIQUE NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    
    -- Training metadata
    trained_at TIMESTAMPTZ,
    data_start TIMESTAMPTZ,
    data_end TIMESTAMPTZ,
    training_version TEXT DEFAULT '1.0.0',
    
    -- Model characteristics
    capacity_scale FLOAT,
    output_horizon INTEGER DEFAULT 96,
    
    -- Storage
    artifact_path TEXT,
    
    -- Metrics (JSONB for flexibility)
    metrics JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick region lookups
CREATE INDEX IF NOT EXISTS idx_model_registry_region_code ON model_registry(region_code);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_model_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER model_registry_updated_at
    BEFORE UPDATE ON model_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_model_registry_updated_at();

-- Enable RLS
ALTER TABLE model_registry ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON model_registry
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow service role to manage
CREATE POLICY "Allow service role all" ON model_registry
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Insert default Swiss Grid entry
INSERT INTO model_registry (region_code, timezone, capacity_scale)
VALUES ('SWISS_GRID', 'Europe/Zurich', 8500.0)
ON CONFLICT (region_code) DO NOTHING;

COMMENT ON TABLE model_registry IS 'Registry of trained XGBoost models per region';
COMMENT ON COLUMN model_registry.region_code IS 'Unique identifier like SWISS_GRID, SOUTH_TN_TNEB';
COMMENT ON COLUMN model_registry.capacity_scale IS 'Typical capacity in MW for this region';
COMMENT ON COLUMN model_registry.metrics IS 'Training metrics: test_mape, test_mae, coverage_90, etc';
