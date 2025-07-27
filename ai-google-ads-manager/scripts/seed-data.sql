-- ====================================
-- AI Ad Manager v4 - Development Seed Data
-- ====================================
-- Run this script after authenticating your first user
-- Replace USER_ID_HERE with the actual authenticated user ID from auth.users

-- Variables (replace these with actual values)
-- USER_ID: Get from Supabase Auth Users table after first login
-- ACCOUNT_ID_1: Will be generated when creating first account
-- ACCOUNT_ID_2: Will be generated when creating second account

-- Example UUIDs for reference (replace with actual ones):
-- USER_ID: from auth.users after Google OAuth login
-- ACCOUNT_ID_1: 660e8400-e29b-41d4-a716-446655440000
-- ACCOUNT_ID_2: 660e8400-e29b-41d4-a716-446655440001

-- ====================================
-- 1. USER PROFILE DATA
-- ====================================
-- Insert user profile (extends auth.users)
-- NOTE: Replace 'USER_ID_HERE' with actual authenticated user ID
/*
INSERT INTO public.users (id, email, role, google_refresh_token) VALUES 
('USER_ID_HERE', 'demo@example.com', 'admin', 'refresh_token_from_oauth')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  google_refresh_token = EXCLUDED.google_refresh_token;
*/

-- ====================================
-- 2. ACCOUNT DATA
-- ====================================
-- Insert sample Google Analytics accounts
-- NOTE: Replace 'USER_ID_HERE' with actual authenticated user ID
/*
INSERT INTO public.accounts (id, user_id, ga_property_id, property_name, timezone, currency_code) VALUES 
('660e8400-e29b-41d4-a716-446655440000', 'USER_ID_HERE', 'GA123456789', 'Demo E-commerce Store', 'America/New_York', 'USD'),
('660e8400-e29b-41d4-a716-446655440001', 'USER_ID_HERE', 'GA987654321', 'Demo Blog Website', 'America/Los_Angeles', 'USD')
ON CONFLICT (id) DO NOTHING;
*/

-- ====================================
-- 3. GA DATA SOURCES
-- ====================================
-- Track data sync status for accounts
/*
INSERT INTO public.ga_data_sources (account_id, source_name, sync_status, last_sync_date, next_sync_date) VALUES 
('660e8400-e29b-41d4-a716-446655440000', 'GA4 Analytics', 'completed', CURRENT_DATE - INTERVAL '1 hour', CURRENT_DATE + INTERVAL '23 hours'),
('660e8400-e29b-41d4-a716-446655440000', 'Google Ads', 'in_progress', CURRENT_DATE - INTERVAL '30 minutes', CURRENT_DATE + INTERVAL '23.5 hours'),
('660e8400-e29b-41d4-a716-446655440001', 'GA4 Analytics', 'completed', CURRENT_DATE - INTERVAL '2 hours', CURRENT_DATE + INTERVAL '22 hours'),
('660e8400-e29b-41d4-a716-446655440001', 'Google Ads', 'failed', CURRENT_DATE - INTERVAL '4 hours', CURRENT_DATE + INTERVAL '20 hours')
ON CONFLICT (account_id, source_name) DO UPDATE SET
  sync_status = EXCLUDED.sync_status,
  last_sync_date = EXCLUDED.last_sync_date,
  next_sync_date = EXCLUDED.next_sync_date;
*/

-- ====================================
-- 4. PERFORMANCE METRICS (GA4 Data)
-- ====================================
-- Insert 30 days of sample analytics data
/*
INSERT INTO public.performance_metrics (
  account_id, date, sessions, users, new_users, bounce_rate, engagement_rate, 
  avg_session_duration, source, medium, campaign
) VALUES 
-- E-commerce Store Data (Account 1)
('660e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '6 days', 1542, 1234, 892, 0.4250, 0.7830, 185.50, 'google', 'cpc', 'summer_sale_2024'),
('660e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '6 days', 325, 298, 145, 0.3890, 0.8120, 225.30, 'facebook', 'social', 'product_showcase'),
('660e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '6 days', 89, 76, 34, 0.4560, 0.7430, 156.20, 'organic', 'organic', NULL),
('660e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '5 days', 1625, 1345, 945, 0.4100, 0.7950, 192.40, 'google', 'cpc', 'summer_sale_2024'),
('660e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '5 days', 398, 342, 198, 0.3650, 0.8350, 245.60, 'facebook', 'social', 'product_showcase'),
('660e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '5 days', 112, 98, 45, 0.4320, 0.7680, 168.90, 'organic', 'organic', NULL),
('660e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '4 days', 1489, 1198, 823, 0.4450, 0.7690, 178.20, 'google', 'cpc', 'summer_sale_2024'),
('660e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '4 days', 287, 256, 156, 0.4020, 0.7980, 198.50, 'instagram', 'social', 'retargeting_campaign'),
('660e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '4 days', 95, 82, 38, 0.4680, 0.7520, 145.30, 'organic', 'organic', NULL),
('660e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '3 days', 1734, 1425, 1025, 0.3890, 0.8150, 205.70, 'google', 'cpc', 'summer_sale_2024'),
('660e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '3 days', 456, 398, 234, 0.3560, 0.8420, 267.80, 'facebook', 'social', 'product_showcase'),
('660e8400-e29b-41d4-a716-446655440000', CURRENT_DATE - INTERVAL '3 days', 134, 118, 56, 0.4190, 0.7840, 172.60, 'organic', 'organic', NULL),

-- Blog Website Data (Account 2)
('660e8400-e29b-41d4-a716-446655440001', CURRENT_DATE - INTERVAL '6 days', 892, 756, 234, 0.3250, 0.8430, 295.50, 'google', 'organic', NULL),
('660e8400-e29b-41d4-a716-446655440001', CURRENT_DATE - INTERVAL '6 days', 156, 134, 89, 0.3890, 0.8120, 325.30, 'facebook', 'social', 'content_promotion'),
('660e8400-e29b-41d4-a716-446655440001', CURRENT_DATE - INTERVAL '5 days', 945, 823, 267, 0.3100, 0.8550, 312.40, 'google', 'organic', NULL),
('660e8400-e29b-41d4-a716-446655440001', CURRENT_DATE - INTERVAL '5 days', 178, 156, 98, 0.3650, 0.8250, 289.60, 'facebook', 'social', 'content_promotion'),
('660e8400-e29b-41d4-a716-446655440001', CURRENT_DATE - INTERVAL '4 days', 823, 712, 198, 0.3450, 0.8320, 287.20, 'google', 'organic', NULL),
('660e8400-e29b-41d4-a716-446655440001', CURRENT_DATE - INTERVAL '4 days', 134, 123, 67, 0.3780, 0.8090, 267.50, 'linkedin', 'social', 'thought_leadership');
*/

-- ====================================
-- 5. PAGE PERFORMANCE DATA
-- ====================================
-- Sample page-level analytics
/*
INSERT INTO public.page_performance (
  account_id, page_path, date, pageviews, unique_pageviews, avg_time_on_page, 
  bounce_rate, entrances, exits
) VALUES 
-- E-commerce Store Pages
('660e8400-e29b-41d4-a716-446655440000', '/', CURRENT_DATE - INTERVAL '1 day', 1234, 987, 145.30, 0.3250, 892, 234),
('660e8400-e29b-41d4-a716-446655440000', '/products', CURRENT_DATE - INTERVAL '1 day', 987, 823, 198.50, 0.2890, 756, 156),
('660e8400-e29b-41d4-a716-446655440000', '/products/category/electronics', CURRENT_DATE - INTERVAL '1 day', 567, 456, 234.70, 0.3120, 423, 89),
('660e8400-e29b-41d4-a716-446655440000', '/checkout', CURRENT_DATE - INTERVAL '1 day', 234, 212, 89.20, 0.1560, 198, 23),
('660e8400-e29b-41d4-a716-446655440000', '/about', CURRENT_DATE - INTERVAL '1 day', 156, 134, 178.90, 0.4230, 123, 67),

-- Blog Website Pages
('660e8400-e29b-41d4-a716-446655440001', '/', CURRENT_DATE - INTERVAL '1 day', 892, 756, 267.50, 0.2890, 634, 178),
('660e8400-e29b-41d4-a716-446655440001', '/blog', CURRENT_DATE - INTERVAL '1 day', 756, 623, 345.80, 0.2340, 567, 134),
('660e8400-e29b-41d4-a716-446655440001', '/blog/ai-trends-2024', CURRENT_DATE - INTERVAL '1 day', 423, 389, 456.90, 0.1890, 356, 89),
('660e8400-e29b-41d4-a716-446655440001', '/blog/machine-learning-guide', CURRENT_DATE - INTERVAL '1 day', 367, 298, 523.40, 0.1650, 278, 67),
('660e8400-e29b-41d4-a716-446655440001', '/contact', CURRENT_DATE - INTERVAL '1 day', 123, 112, 89.70, 0.3890, 98, 45);
*/

-- ====================================
-- 6. RECOMMENDATIONS DATA
-- ====================================
-- AI-generated optimization suggestions
/*
INSERT INTO public.recommendations (
  account_id, type, priority, title, description, status, estimated_impact
) VALUES 
-- E-commerce Store Recommendations
('660e8400-e29b-41d4-a716-446655440000', 'campaign_optimization', 'high', 'Increase Budget for High-Performing Campaign', 
 'Your "summer_sale_2024" campaign has a 7.8% conversion rate, 23% above average. Consider increasing daily budget by 30% to capitalize on performance.', 
 'pending', 0.23),
('660e8400-e29b-41d4-a716-446655440000', 'keyword_expansion', 'medium', 'Add Long-Tail Keywords for Electronics', 
 'Analysis shows opportunity for "affordable wireless headphones" and "best budget smartphones 2024" keywords with low competition.', 
 'pending', 0.15),
('660e8400-e29b-41d4-a716-446655440000', 'landing_page', 'high', 'Optimize Checkout Page Load Time', 
 'Checkout page has 3.2s load time and 15.6% bounce rate. Reducing to <2s could improve conversions by 8-12%.', 
 'in_progress', 0.10),
('660e8400-e29b-41d4-a716-446655440000', 'audience_targeting', 'medium', 'Create Custom Audience for Cart Abandoners', 
 'Set up retargeting campaign for users who added items to cart but did not complete purchase in last 30 days.', 
 'pending', 0.18),

-- Blog Website Recommendations  
('660e8400-e29b-41d4-a716-446655440001', 'content_optimization', 'high', 'Optimize Top-Performing Blog Posts for SEO', 
 'Your AI trends article has high engagement but ranks page 2. Adding internal links and meta descriptions could improve rankings.', 
 'pending', 0.25),
('660e8400-e29b-41d4-a716-446655440001', 'social_promotion', 'medium', 'Increase LinkedIn Promotion for B2B Content', 
 'Your machine learning guide performs 34% better on LinkedIn vs other platforms. Consider increasing LinkedIn ad spend.', 
 'completed', 0.12),
('660e8400-e29b-41d4-a716-446655440001', 'email_capture', 'medium', 'Add Newsletter Signup to High-Traffic Pages', 
 'Pages with >300 avg time have 0.8% email capture rate. Industry average is 2.3%. Adding targeted popups could improve by 150%.', 
 'pending', 0.20);
*/

-- ====================================
-- 7. LANDING PAGE ANALYSIS DATA
-- ====================================
-- Firecrawl analysis results with JSONB data
/*
INSERT INTO public.landing_page_analysis (
  account_id, page_url, analysis_type, status, 
  content_data, seo_score, performance_score, recommendations
) VALUES 
('660e8400-e29b-41d4-a716-446655440000', 'https://demo-store.com/', 'full_analysis', 'completed',
 '{"title": "Demo E-commerce Store - Best Products Online", "meta_description": "Shop the latest products with fast shipping and great prices", "h1_tags": ["Welcome to Demo Store", "Featured Products"], "word_count": 245, "images": 12, "links": {"internal": 23, "external": 5}}',
 85, 78, 
 '["Add alt text to 3 product images", "Improve meta description length (current: 52 chars, recommended: 150-160)", "Add schema markup for products"]'),
 
('660e8400-e29b-41d4-a716-446655440000', 'https://demo-store.com/products', 'seo_analysis', 'completed',
 '{"title": "All Products - Demo Store", "meta_description": "Browse our complete product catalog", "h1_tags": ["Our Products"], "word_count": 189, "images": 24, "links": {"internal": 45, "external": 2}}',
 72, 81,
 '["Expand meta description", "Add product category descriptions", "Implement pagination meta tags"]'),

('660e8400-e29b-41d4-a716-446655440001', 'https://demo-blog.com/', 'content_analysis', 'completed',
 '{"title": "AI & Tech Insights Blog", "meta_description": "Latest insights on artificial intelligence, machine learning, and technology trends", "h1_tags": ["AI & Tech Insights"], "word_count": 567, "images": 6, "links": {"internal": 15, "external": 8}}',
 92, 88,
 '["Excellent content quality", "Consider adding video content", "Add social sharing buttons"]'),

('660e8400-e29b-41d4-a716-446655440001', 'https://demo-blog.com/blog/ai-trends-2024', 'performance_analysis', 'completed',
 '{"title": "AI Trends 2024: What to Expect", "meta_description": "Comprehensive guide to AI trends shaping 2024 including LLMs, computer vision, and automation", "h1_tags": ["AI Trends 2024", "Key Technologies", "Future Predictions"], "word_count": 1234, "images": 8, "links": {"internal": 12, "external": 15}}',
 96, 85,
 '["Excellent SEO optimization", "Strong content depth", "Consider adding interactive elements"]');
*/

-- ====================================
-- INSTRUCTIONS FOR USE
-- ====================================
/*
To use this seed data:

1. First authenticate a user via Google OAuth in your app
2. Get the user ID from the auth.users table in Supabase
3. Replace 'USER_ID_HERE' with the actual user ID
4. Uncomment the sections you want to populate
5. Run the SQL commands in Supabase SQL Editor

Note: The account IDs used here are examples. You can:
- Use these exact UUIDs if you want consistent test data
- Generate new UUIDs for your accounts
- Let Supabase auto-generate them and update references

This seed data provides:
- 2 sample accounts (e-commerce & blog)
- 7 days of performance metrics  
- Page-level analytics data
- AI-generated recommendations
- Landing page analysis results
- Data sync status tracking
*/ 