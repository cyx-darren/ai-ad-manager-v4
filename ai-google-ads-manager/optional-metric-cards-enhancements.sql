-- OPTIONAL ENHANCEMENTS for Metric Cards (Phases 2-10)
-- These are NOT required but could provide additional benefits

-- 1. OPTIONAL: Persistent MCP Performance Monitoring
-- Tracks MCP tool performance over time (beyond in-memory monitoring)
CREATE TABLE IF NOT EXISTS mcp_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  card_type TEXT NOT NULL, -- 'total-campaigns', 'impressions', etc.
  request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  response_time_ms INTEGER,
  was_successful BOOLEAN DEFAULT true,
  error_message TEXT,
  data_source TEXT CHECK (data_source IN ('mcp', 'cache', 'fallback')),
  feature_flag_enabled BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE mcp_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own metrics
CREATE POLICY "Users can view own MCP metrics" 
ON mcp_performance_metrics FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Policy: Users can insert their own metrics
CREATE POLICY "Users can insert own MCP metrics" 
ON mcp_performance_metrics FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_mcp_metrics_user_card_time 
ON mcp_performance_metrics(user_id, card_type, request_timestamp DESC);

-- 2. OPTIONAL: Persistent Data Cache
-- Cache MCP responses across sessions for better performance
CREATE TABLE IF NOT EXISTS mcp_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL, -- composite key of card_type + parameters
  card_type TEXT NOT NULL,
  cached_data JSONB NOT NULL,
  property_id TEXT,
  date_range_start DATE,
  date_range_end DATE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS  
ALTER TABLE mcp_data_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read cache
CREATE POLICY "Authenticated users can read cache" 
ON mcp_data_cache FOR SELECT 
TO authenticated 
USING (true);

-- Policy: Allow all authenticated users to write cache
CREATE POLICY "Authenticated users can write cache" 
ON mcp_data_cache FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Auto-cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM mcp_data_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Index for fast cache lookups
CREATE INDEX IF NOT EXISTS idx_cache_key_expires 
ON mcp_data_cache(cache_key, expires_at);

-- 3. OPTIONAL: User Feature Flag Overrides  
-- Allow specific users to override feature flags for testing
CREATE TABLE IF NOT EXISTS user_feature_flag_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  flag_name TEXT NOT NULL REFERENCES feature_flags(flag_name),
  is_enabled BOOLEAN NOT NULL,
  reason TEXT, -- Why this override exists
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, flag_name)
);

-- Enable RLS
ALTER TABLE user_feature_flag_overrides ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own overrides
CREATE POLICY "Users can view own flag overrides" 
ON user_feature_flag_overrides FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Policy: Admins can manage all overrides
CREATE POLICY "Admins can manage flag overrides" 
ON user_feature_flag_overrides FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.email LIKE '%@admin.%' OR
      auth.users.email = 'admin@example.com'
    )
  )
);

-- 4. OPTIONAL: MCP Error Log
-- Track MCP failures for debugging and monitoring
CREATE TABLE IF NOT EXISTS mcp_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  card_type TEXT NOT NULL,
  error_type TEXT NOT NULL, -- 'timeout', 'api_error', 'network_error', etc.
  error_message TEXT NOT NULL,
  mcp_tool_name TEXT, -- 'google-ads-get-campaigns', etc.
  request_parameters JSONB,
  stack_trace TEXT,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE mcp_error_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own errors
CREATE POLICY "Users can view own MCP errors" 
ON mcp_error_log FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Policy: Users can insert their own errors
CREATE POLICY "Users can insert own MCP errors" 
ON mcp_error_log FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Index for error analysis
CREATE INDEX IF NOT EXISTS idx_mcp_errors_type_time 
ON mcp_error_log(card_type, error_type, created_at DESC);

-- SUMMARY QUERY: Check what tables now exist
SELECT 
  schemaname,
  tablename,
  tableowner,
  hasrls as "Row Level Security"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%feature_flag%' OR tablename LIKE '%mcp_%'
ORDER BY tablename;