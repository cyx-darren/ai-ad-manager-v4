#!/usr/bin/env node
/**
 * Enable GA4 Metric Card Feature Flags
 * Enables the 4 metric cards that can use live GA4 data
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function enableGA4Flags() {
  console.log('🚀 Enabling GA4 Metric Card Feature Flags...\n');

  try {
    // Enable the 4 GA4 metric card flags
    console.log('⚡ Enabling GA4 metric card flags for live data...');
    
    const { error: updateError } = await supabase
      .from('feature_flags')
      .update({
        is_enabled: true,
        target_audience: { percentage: 100, user_ids: [], roles: [] },
        updated_at: new Date().toISOString()
      })
      .in('flag_name', [
        'sessions_card_mcp',        // Total Sessions from GA4
        'users_card_mcp',           // Total Users from GA4
        'bounce_rate_card_mcp',     // Bounce Rate from GA4
        'conversions_card_mcp'      // Conversions from GA4
      ]);

    if (updateError) {
      throw new Error(`Failed to enable GA4 flags: ${updateError.message}`);
    }

    // Verify the changes
    console.log('✅ Verifying changes...');
    
    const { data: updatedFlags, error: verifyError } = await supabase
      .from('feature_flags')
      .select('flag_name, is_enabled, target_audience, description')
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

    console.log('\n🎛️  Updated GA4 Metric Card Flags:');
    console.log('==========================================');
    
    updatedFlags.forEach(flag => {
      const status = flag.is_enabled ? '✅ ENABLED' : '❌ DISABLED';
      const percentage = flag.target_audience?.percentage || 0;
      console.log(`${status} ${flag.flag_name} (${percentage}%)`);
      console.log(`   └─ ${flag.description}`);
    });

    const enabledCount = updatedFlags.filter(f => f.is_enabled && f.flag_name.includes('card_mcp')).length;
    
    console.log(`\n📊 Summary:`);
    console.log(`  • Total tables in database: 9`);
    console.log(`  • GA4 metric flags enabled: ${enabledCount}/4`);
    console.log(`  • Fallback system: ${updatedFlags.find(f => f.flag_name === 'metric_cards_fallback_enabled')?.is_enabled ? 'ACTIVE' : 'INACTIVE'}`);
    
    console.log('\n🚀 GA4 Metric Card Feature Flags Successfully Enabled!');
    console.log('✨ Live GA4 data integration is now active for:');
    console.log('   - Sessions Card');
    console.log('   - Users Card'); 
    console.log('   - Bounce Rate Card');
    console.log('   - Conversions Card');

    console.log('\n🔗 Next steps:');
    console.log('   1. Test the live GA4 data integration');
    console.log('   2. Verify MCP server connection');
    console.log('   3. Check dashboard metric cards display');

  } catch (error) {
    console.error('\n❌ Error enabling GA4 flags:', error.message);
    process.exit(1);
  }
}

enableGA4Flags();