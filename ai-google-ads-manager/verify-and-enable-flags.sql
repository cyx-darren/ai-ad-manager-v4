-- Verify and Enable GA4 Metric Card Feature Flags
-- Run this in your Supabase SQL Editor for the 'ai-ad-manager-v2' project

-- First, check current status
SELECT 
    'BEFORE UPDATE' as status,
    flag_name, 
    is_enabled, 
    target_audience->>'percentage' as percentage,
    description
FROM feature_flags 
WHERE flag_name IN (
    'sessions_card_mcp',
    'users_card_mcp', 
    'bounce_rate_card_mcp',
    'conversions_card_mcp',
    'metric_cards_fallback_enabled'
)
ORDER BY flag_name;

-- Enable the GA4 metric card flags
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

-- Ensure fallback is enabled for graceful degradation
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
    'AFTER UPDATE' as status,
    flag_name, 
    is_enabled, 
    target_audience->>'percentage' as percentage,
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