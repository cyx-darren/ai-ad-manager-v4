-- Create feature_flags table for Subtask 29.1 implementation
-- This enables feature flag control for metric card migration

-- Create the feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  target_audience JSONB DEFAULT jsonb_build_object(
    'percentage', 0,
    'user_ids', '[]'::jsonb,
    'roles', '[]'::jsonb
  ),
  metadata JSONB DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read feature flags
CREATE POLICY IF NOT EXISTS "Allow read access to feature flags" 
ON feature_flags FOR SELECT 
TO authenticated 
USING (true);

-- Allow admin users to manage feature flags (users with @admin in email)
CREATE POLICY IF NOT EXISTS "Allow admin to manage feature flags" 
ON feature_flags FOR ALL 
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

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create trigger for feature_flags
DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER update_feature_flags_updated_at 
BEFORE UPDATE ON feature_flags 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default feature flags for metric card migration
INSERT INTO feature_flags (flag_name, is_enabled, description, target_audience) VALUES
-- Master control flags
('metric_cards_migration_enabled', false, 'Master flag for metric cards migration', 
  jsonb_build_object('percentage', 0, 'user_ids', '[]'::jsonb, 'roles', '[]'::jsonb)),
('metric_cards_fallback_enabled', true, 'Enable fallback to mock data when MCP fails', 
  jsonb_build_object('percentage', 100, 'user_ids', '[]'::jsonb, 'roles', '[]'::jsonb)),
('metric_cards_monitoring_enabled', true, 'Enable performance monitoring for metric cards', 
  jsonb_build_object('percentage', 100, 'user_ids', '[]'::jsonb, 'roles', '[]'::jsonb)),

-- Individual metric card flags
('total_campaigns_card_mcp', false, 'Enable MCP data for Total Campaigns card', 
  jsonb_build_object('percentage', 0, 'user_ids', '[]'::jsonb, 'roles', '[]'::jsonb)),
('impressions_card_mcp', false, 'Enable MCP data for Impressions card', 
  jsonb_build_object('percentage', 0, 'user_ids', '[]'::jsonb, 'roles', '[]'::jsonb)),
('click_rate_card_mcp', false, 'Enable MCP data for Click Rate card', 
  jsonb_build_object('percentage', 0, 'user_ids', '[]'::jsonb, 'roles', '[]'::jsonb)),
('sessions_card_mcp', false, 'Enable MCP data for Sessions card', 
  jsonb_build_object('percentage', 0, 'user_ids', '[]'::jsonb, 'roles', '[]'::jsonb)),
('users_card_mcp', false, 'Enable MCP data for Users card', 
  jsonb_build_object('percentage', 0, 'user_ids', '[]'::jsonb, 'roles', '[]'::jsonb)),
('bounce_rate_card_mcp', false, 'Enable MCP data for Bounce Rate card', 
  jsonb_build_object('percentage', 0, 'user_ids', '[]'::jsonb, 'roles', '[]'::jsonb)),
('conversions_card_mcp', false, 'Enable MCP data for Conversions card', 
  jsonb_build_object('percentage', 0, 'user_ids', '[]'::jsonb, 'roles', '[]'::jsonb)),
('total_spend_card_mcp', false, 'Enable MCP data for Total Spend card', 
  jsonb_build_object('percentage', 0, 'user_ids', '[]'::jsonb, 'roles', '[]'::jsonb))

ON CONFLICT (flag_name) DO UPDATE SET
  description = EXCLUDED.description,
  target_audience = EXCLUDED.target_audience,
  updated_at = NOW();

-- Verify the setup
SELECT 
  flag_name, 
  is_enabled, 
  description,
  created_at
FROM feature_flags 
ORDER BY flag_name;