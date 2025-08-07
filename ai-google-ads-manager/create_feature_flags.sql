-- Create feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag_name TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  target_audience JSONB DEFAULT '{
    "percentage": 0,
    "user_ids": [],
    "roles": []
  }'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Allow all users to read feature flags
CREATE POLICY IF NOT EXISTS "Allow read access to feature flags" 
ON feature_flags FOR SELECT 
TO authenticated 
USING (true);

-- Allow admin users to manage feature flags
CREATE POLICY IF NOT EXISTS "Allow admin to manage feature flags" 
ON feature_flags FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email LIKE '%@admin.%'
  )
);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER update_feature_flags_updated_at 
BEFORE UPDATE ON feature_flags 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default feature flags
INSERT INTO feature_flags (flag_name, is_enabled, description, target_audience) VALUES
('metric_cards_migration_enabled', false, 'Master flag for metric cards migration', '{"percentage": 0, "user_ids": [], "roles": []}'),
('metric_cards_fallback_enabled', true, 'Enable fallback to mock data when MCP fails', '{"percentage": 100, "user_ids": [], "roles": []}'),
('metric_cards_monitoring_enabled', true, 'Enable performance monitoring for metric cards', '{"percentage": 100, "user_ids": [], "roles": []}'),
('total_campaigns_card_mcp', false, 'Enable MCP data for Total Campaigns card', '{"percentage": 0, "user_ids": [], "roles": []}'),
('impressions_card_mcp', false, 'Enable MCP data for Impressions card', '{"percentage": 0, "user_ids": [], "roles": []}'),
('click_rate_card_mcp', false, 'Enable MCP data for Click Rate card', '{"percentage": 0, "user_ids": [], "roles": []}'),
('sessions_card_mcp', false, 'Enable MCP data for Sessions card', '{"percentage": 0, "user_ids": [], "roles": []}'),
('users_card_mcp', false, 'Enable MCP data for Users card', '{"percentage": 0, "user_ids": [], "roles": []}'),
('bounce_rate_card_mcp', false, 'Enable MCP data for Bounce Rate card', '{"percentage": 0, "user_ids": [], "roles": []}'),
('conversions_card_mcp', false, 'Enable MCP data for Conversions card', '{"percentage": 0, "user_ids": [], "roles": []}'),
('total_spend_card_mcp', false, 'Enable MCP data for Total Spend card', '{"percentage": 0, "user_ids": [], "roles": []}')
ON CONFLICT (flag_name) DO UPDATE SET
  description = EXCLUDED.description,
  target_audience = EXCLUDED.target_audience,
  updated_at = NOW();
