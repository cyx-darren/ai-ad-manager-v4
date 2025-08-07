-- Direct SQL to enable GA4 metric card feature flags
-- Run this in Supabase SQL Editor or via supabase-mcp

-- Enable the 4 GA4 metric card flags that can use live data
UPDATE feature_flags 
SET 
    is_enabled = true,
    target_audience = '{"percentage": 100, "user_ids": [], "roles": []}',
    updated_at = NOW()
WHERE flag_name IN (
    'sessions_card_mcp',        -- Total Sessions from GA4
    'users_card_mcp',           -- Total Users from GA4  
    'bounce_rate_card_mcp',     -- Bounce Rate from GA4
    'conversions_card_mcp'      -- Conversions from GA4
);

-- Also ensure fallback is enabled for graceful degradation
UPDATE feature_flags 
SET 
    is_enabled = true,
    target_audience = '{"percentage": 100, "user_ids": [], "roles": []}',
    updated_at = NOW()
WHERE flag_name = 'metric_cards_fallback_enabled';

-- Verify the results
SELECT 
    flag_name, 
    is_enabled, 
    target_audience,
    description,
    updated_at
FROM feature_flags 
WHERE flag_name IN (
    'sessions_card_mcp',
    'users_card_mcp', 
    'bounce_rate_card_mcp',
    'conversions_card_mcp',
    'metric_cards_fallback_enabled'
)
ORDER BY flag_name;