-- =====================================================
-- POWERCAST AI - Supabase Database Schema
-- =====================================================
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PLANTS TABLE
-- =====================================================
CREATE TABLE plants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('solar', 'hydro', 'nuclear', 'thermal', 'wind')),
  capacity_mw DECIMAL(10,2) NOT NULL CHECK (capacity_mw > 0),
  current_output_mw DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (current_output_mw >= 0),
  status VARCHAR(50) NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'maintenance')),
  location VARCHAR(255),
  efficiency_pct DECIMAL(5,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- FORECAST_DATA TABLE
-- =====================================================
CREATE TABLE forecast_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  output_mw DECIMAL(10,2) NOT NULL,
  temperature DECIMAL(5,2),
  humidity DECIMAL(5,2),
  wind_speed DECIMAL(5,2),
  cloud_cover DECIMAL(5,2),
  irradiance DECIMAL(10,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- UPLOADS TABLE
-- =====================================================
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  rows_count INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- =====================================================
-- OPTIMIZATION_SUGGESTIONS TABLE
-- =====================================================
CREATE TABLE optimization_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('dispatch', 'maintenance', 'cost', 'efficiency')),
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  impact_metric VARCHAR(100),
  impact_value VARCHAR(50),
  confidence DECIMAL(5,2) NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  affected_plant_ids UUID[] DEFAULT ARRAY[]::UUID[],
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

-- =====================================================
-- REAL-TIME METRICS TABLE (for live updates)
-- =====================================================
CREATE TABLE plant_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  output_mw DECIMAL(10,2) NOT NULL,
  efficiency_pct DECIMAL(5,2),
  status VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(plant_id, timestamp)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_plants_user_id ON plants(user_id);
CREATE INDEX idx_plants_type ON plants(type);
CREATE INDEX idx_plants_status ON plants(status);

CREATE INDEX idx_forecast_data_plant_id ON forecast_data(plant_id);
CREATE INDEX idx_forecast_data_timestamp ON forecast_data(timestamp);

CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_uploads_plant_id ON uploads(plant_id);
CREATE INDEX idx_uploads_status ON uploads(status);

CREATE INDEX idx_optimization_suggestions_user_id ON optimization_suggestions(user_id);
CREATE INDEX idx_optimization_suggestions_status ON optimization_suggestions(status);
CREATE INDEX idx_optimization_suggestions_priority ON optimization_suggestions(priority);

CREATE INDEX idx_plant_metrics_plant_id ON plant_metrics(plant_id);
CREATE INDEX idx_plant_metrics_timestamp ON plant_metrics(timestamp);

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_plants_updated_at BEFORE UPDATE ON plants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plant_metrics ENABLE ROW LEVEL SECURITY;

-- Plants: Users can only see their own plants
CREATE POLICY "Users can view own plants"
  ON plants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own plants"
  ON plants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plants"
  ON plants FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plants"
  ON plants FOR DELETE
  USING (auth.uid() = user_id);

-- Forecast Data: Users can only see data for their plants
CREATE POLICY "Users can view own forecast data"
  ON forecast_data FOR SELECT
  USING (plant_id IN (SELECT id FROM plants WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own forecast data"
  ON forecast_data FOR INSERT
  WITH CHECK (plant_id IN (SELECT id FROM plants WHERE user_id = auth.uid()));

-- Uploads: Users can only see their own uploads
CREATE POLICY "Users can view own uploads"
  ON uploads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own uploads"
  ON uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Optimization Suggestions: Users can only see their own suggestions
CREATE POLICY "Users can view own suggestions"
  ON optimization_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own suggestions"
  ON optimization_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suggestions"
  ON optimization_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

-- Plant Metrics: Users can only see metrics for their plants
CREATE POLICY "Users can view own plant metrics"
  ON plant_metrics FOR SELECT
  USING (plant_id IN (SELECT id FROM plants WHERE user_id = auth.uid()));

-- =====================================================
-- SEED DATA (Optional - for testing)
-- =====================================================

-- Create demo plants for authenticated users
-- INSERT INTO plants (user_id, name, type, capacity_mw, current_output_mw, status, location, efficiency_pct)
-- VALUES
--   (auth.uid(), 'Solar Farm Alpha', 'solar', 500, 423, 'online', 'Zurich, CH', 84.6),
--   (auth.uid(), 'Hydro Station Beta', 'hydro', 800, 620, 'online', 'Lucerne, CH', 77.5),
--   (auth.uid(), 'Nuclear Plant Gamma', 'nuclear', 1000, 950, 'online', 'Bern, CH', 95.0);

-- =====================================================
-- GENERATORS TABLE (FR1: Generator Configuration)
-- =====================================================
CREATE TABLE generators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  capacity_mw DECIMAL(10,2) NOT NULL CHECK (capacity_mw > 0),
  min_turndown_pct DECIMAL(5,2) NOT NULL DEFAULT 30 CHECK (min_turndown_pct BETWEEN 0 AND 100),
  ramp_rate_mw_min DECIMAL(10,2) NOT NULL DEFAULT 10 CHECK (ramp_rate_mw_min >= 0),
  is_online BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generators_plant_id ON generators(plant_id);

CREATE TRIGGER update_generators_updated_at BEFORE UPDATE ON generators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE generators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generators"
  ON generators FOR SELECT
  USING (plant_id IN (SELECT id FROM plants WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own generators"
  ON generators FOR INSERT
  WITH CHECK (plant_id IN (SELECT id FROM plants WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own generators"
  ON generators FOR UPDATE
  USING (plant_id IN (SELECT id FROM plants WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own generators"
  ON generators FOR DELETE
  USING (plant_id IN (SELECT id FROM plants WHERE user_id = auth.uid()));

-- =====================================================
-- WEATHER_CACHE TABLE (FR4: Weather API Caching)
-- =====================================================
CREATE TABLE weather_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  latitude DECIMAL(10,6) NOT NULL,
  longitude DECIMAL(10,6) NOT NULL,
  location_name VARCHAR(255),
  temperature_c DECIMAL(5,2),
  humidity_pct DECIMAL(5,2),
  wind_speed_ms DECIMAL(5,2),
  cloud_cover_pct DECIMAL(5,2),
  weather_condition VARCHAR(100),
  weather_icon VARCHAR(20),
  raw_data JSONB DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  UNIQUE(latitude, longitude)
);

CREATE INDEX idx_weather_cache_location ON weather_cache(latitude, longitude);
CREATE INDEX idx_weather_cache_expires ON weather_cache(expires_at);

-- No RLS on weather_cache - shared public data

-- =====================================================
-- SCADA_CONNECTIONS TABLE (FR5: SCADA Config)
-- =====================================================
CREATE TABLE scada_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
  endpoint_url VARCHAR(500) NOT NULL,
  port INTEGER NOT NULL DEFAULT 4840 CHECK (port BETWEEN 1 AND 65535),
  security_mode VARCHAR(50) NOT NULL DEFAULT 'None' CHECK (security_mode IN ('None', 'Sign', 'SignAndEncrypt')),
  security_policy VARCHAR(50) NOT NULL DEFAULT 'None' CHECK (security_policy IN ('None', 'Basic128Rsa15', 'Basic256', 'Basic256Sha256')),
  username VARCHAR(255),
  password_encrypted TEXT, -- Store encrypted, not plaintext
  polling_interval_sec INTEGER NOT NULL DEFAULT 60 CHECK (polling_interval_sec >= 10),
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_connected_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plant_id)
);

CREATE INDEX idx_scada_connections_plant_id ON scada_connections(plant_id);

CREATE TRIGGER update_scada_connections_updated_at BEFORE UPDATE ON scada_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE scada_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own SCADA connections"
  ON scada_connections FOR SELECT
  USING (plant_id IN (SELECT id FROM plants WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own SCADA connections"
  ON scada_connections FOR INSERT
  WITH CHECK (plant_id IN (SELECT id FROM plants WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own SCADA connections"
  ON scada_connections FOR UPDATE
  USING (plant_id IN (SELECT id FROM plants WHERE user_id = auth.uid()));

-- =====================================================
-- FUNCTIONS & STORED PROCEDURES
-- =====================================================

-- Function to get plant total generator capacity
CREATE OR REPLACE FUNCTION get_plant_generator_capacity(p_plant_id UUID)
RETURNS TABLE (
  total_capacity DECIMAL,
  online_capacity DECIMAL,
  generator_count INTEGER,
  online_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(g.capacity_mw), 0) as total_capacity,
    COALESCE(SUM(CASE WHEN g.is_online THEN g.capacity_mw ELSE 0 END), 0) as online_capacity,
    COUNT(g.id)::INTEGER as generator_count,
    COUNT(CASE WHEN g.is_online THEN 1 END)::INTEGER as online_count
  FROM generators g
  WHERE g.plant_id = p_plant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean expired weather cache
CREATE OR REPLACE FUNCTION clean_expired_weather_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM weather_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get latest forecast for a plant
CREATE OR REPLACE FUNCTION get_latest_forecast(p_plant_id UUID, p_limit INTEGER DEFAULT 24)
RETURNS TABLE (
  timestamp TIMESTAMPTZ,
  output_mw DECIMAL,
  temperature DECIMAL,
  humidity DECIMAL,
  wind_speed DECIMAL,
  cloud_cover DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.timestamp,
    f.output_mw,
    f.temperature,
    f.humidity,
    f.wind_speed,
    f.cloud_cover
  FROM forecast_data f
  WHERE f.plant_id = p_plant_id
  ORDER BY f.timestamp DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- END OF SCHEMA
-- =====================================================
