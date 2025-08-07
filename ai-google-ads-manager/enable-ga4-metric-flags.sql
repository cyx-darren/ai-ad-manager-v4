-- Enable GA4 metric card feature flags for live data integration
-- This enables live GA4 data for the 4 metric cards that can use GA4 Analytics MCP

-- Enable GA4-compatible metric cards with 100% rollout
UPDATE feature_flags 
SET 
    is_enabled = true,
    target_audience = jsonb_build_object(
        'percentage', 100, 
        'user_ids', '[]'::jsonb, 
        'roles', '[]'::jsonb
    ),
    updated_at = NOW()
WHERE flag_name IN (
    'sessions_card_mcp',        -- Total Sessions from GA4
    'users_card_mcp',           -- Total Users from GA4  
    'bounce_rate_card_mcp',     -- Bounce Rate from GA4
    'conversions_card_mcp'      -- Conversions from GA4
);

-- Also enable the fallback system to ensure graceful degradation
UPDATE feature_flags 
SET 
    is_enabled = true,
    target_audience = jsonb_build_object(
        'percentage', 100, 
        'user_ids', '[]'::jsonb, 
        'roles', '[]'::jsonb
    ),
    updated_at = NOW()
WHERE flag_name = 'metric_cards_fallback_enabled';

-- Verify the changes
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