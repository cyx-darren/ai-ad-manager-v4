#!/usr/bin/env node
/**
 * Setup and Enable GA4 Feature Flags
 * 1. Creates feature flags if they don't exist
 * 2. Enables the specific GA4 flags needed
 * 3. Verifies the results
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to load .env file if available
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  console.log('Note: dotenv not available, using environment variables directly');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and (NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAndEnableGA4Flags() {
  console.log('🚀 Setting up and enabling GA4 feature flags...\n');

  try {
    // Step 1: Check current state
    console.log('📊 Step 1: Checking current feature flag state...');
    const { data: currentFlags, error: checkError } = await supabase
      .from('feature_flags')
      .select('flag_name, is_enabled')
      .in('flag_name', [
        'sessions_card_mcp',
        'users_card_mcp',
        'bounce_rate_card_mcp',
        'conversions_card_mcp',
        'metric_cards_fallback_enabled'
      ]);

    if (checkError) {
      throw new Error(`Failed to check feature flags: ${checkError.message}`);
    }

    console.log(`Found ${currentFlags.length} existing GA4-related flags`);

    // Step 2: Create missing flags if needed
    if (currentFlags.length === 0) {
      console.log('🔧 Step 2: Creating feature flags (table appears empty)...');
      
      const flagsToCreate = [
        {
          flag_name: 'metric_cards_migration_enabled',
          is_enabled: false,
          description: 'Master flag for metric cards migration',
          target_audience: { percentage: 0, user_ids: [], roles: [] }
        },
        {
          flag_name: 'metric_cards_fallback_enabled',
          is_enabled: true,
          description: 'Enable fallback to mock data when MCP fails',
          target_audience: { percentage: 100, user_ids: [], roles: [] }
        },
        {
          flag_name: 'sessions_card_mcp',
          is_enabled: false,
          description: 'Enable MCP data for Sessions card',
          target_audience: { percentage: 0, user_ids: [], roles: [] }
        },
        {
          flag_name: 'users_card_mcp',
          is_enabled: false,
          description: 'Enable MCP data for Users card',
          target_audience: { percentage: 0, user_ids: [], roles: [] }
        },
        {
          flag_name: 'bounce_rate_card_mcp',
          is_enabled: false,
          description: 'Enable MCP data for Bounce Rate card',
          target_audience: { percentage: 0, user_ids: [], roles: [] }
        },
        {
          flag_name: 'conversions_card_mcp',
          is_enabled: false,
          description: 'Enable MCP data for Conversions card',
          target_audience: { percentage: 0, user_ids: [], roles: [] }
        }
      ];

      const { error: insertError } = await supabase
        .from('feature_flags')
        .insert(flagsToCreate);

      if (insertError) {
        throw new Error(`Failed to create feature flags: ${insertError.message}`);
      }

      console.log('✅ Created missing feature flags');
    } else {
      console.log('✅ Step 2: Feature flags already exist, proceeding to enable...');
    }

    // Step 3: Enable the GA4 flags
    console.log('🎯 Step 3: Enabling GA4 metric card flags...');
    
    const { error: enableError } = await supabase
      .from('feature_flags')
      .update({
        is_enabled: true,
        target_audience: { percentage: 100, user_ids: [], roles: [] },
        updated_at: new Date().toISOString()
      })
      .in('flag_name', [
        'sessions_card_mcp',
        'users_card_mcp',
        'bounce_rate_card_mcp',
        'conversions_card_mcp'
      ]);

    if (enableError) {
      throw new Error(`Failed to enable GA4 flags: ${enableError.message}`);
    }

    // Step 4: Ensure fallback is enabled
    console.log('🔄 Step 4: Ensuring fallback flag is enabled...');
    
    const { error: fallbackError } = await supabase
      .from('feature_flags')
      .update({
        is_enabled: true,
        target_audience: { percentage: 100, user_ids: [], roles: [] },
        updated_at: new Date().toISOString()
      })
      .eq('flag_name', 'metric_cards_fallback_enabled');

    if (fallbackError) {
      throw new Error(`Failed to enable fallback flag: ${fallbackError.message}`);
    }

    // Step 5: Verify results
    console.log('🔍 Step 5: Verifying results...\n');
    
    const { data: verifyFlags, error: verifyError } = await supabase
      .from('feature_flags')
      .select('flag_name, is_enabled, target_audience, description, updated_at')
      .in('flag_name', [
        'sessions_card_mcp',
        'users_card_mcp',
        'bounce_rate_card_mcp',
        'conversions_card_mcp',
        'metric_cards_fallback_enabled'
      ])
      .order('flag_name');

    if (verifyError) {
      throw new Error(`Failed to verify flags: ${verifyError.message}`);
    }

    console.log('🎛️  Final Feature Flag States:');
    console.log('==========================================');
    
    verifyFlags.forEach(flag => {
      const status = flag.is_enabled ? '✅ ENABLED' : '❌ DISABLED';
      const percentage = flag.target_audience?.percentage || 0;
      const updatedDate = new Date(flag.updated_at).toLocaleString();
      console.log(`${status} ${flag.flag_name} (${percentage}%)`);
      console.log(`   └─ ${flag.description}`);
      console.log(`   └─ Updated: ${updatedDate}`);
    });

    console.log('\n🎉 Success! GA4 metric card feature flags have been enabled.');
    console.log('\nNext steps:');
    console.log('1. The dashboard should now use live GA4 data for these metrics');
    console.log('2. Fallback is enabled for graceful degradation if MCP fails');
    console.log('3. Monitor the dashboard to ensure everything is working correctly');

  } catch (error) {
    console.error('❌ Error setting up feature flags:', error.message);
    
    if (error.message.includes('JWT')) {
      console.error('🔑 This might be an authentication issue. Make sure your Supabase keys are correct.');
    }
    
    process.exit(1);
  }
}

setupAndEnableGA4Flags();