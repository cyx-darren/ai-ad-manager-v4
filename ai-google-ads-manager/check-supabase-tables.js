#!/usr/bin/env node
/**
 * Check Supabase Database Tables and Feature Flag States
 * Uses standard Supabase client to query the ai-ad-manager-v2 project
 */

const { createClient } = require('@supabase/supabase-js');

// Try to load .env file if available
try {
  require('dotenv').config();
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

async function checkDatabase() {
  console.log('🔍 Checking Supabase Database for ai-ad-manager-v2...\n');

  try {
    // Skip complex table info queries and go straight to checking known tables
    console.log('📊 Step 1: Checking database connection...');

    // Check feature_flags table as a connection test
    console.log('🚩 Step 2: Checking feature_flags table...');
    const { data: flags, error: flagsError, count } = await supabase
      .from('feature_flags')
      .select('*', { count: 'exact' });

    if (flagsError) {
      throw new Error(`Failed to query feature_flags: ${flagsError.message}`);
    }

    console.log(`✅ Successfully connected to Supabase!`);
    console.log(`📋 Found ${count} feature flags in the database\n`);

    // Display feature flag states
    console.log('🎛️  Current Feature Flag States:');
    console.log('==========================================');
    
    const ga4Flags = flags.filter(flag => flag.flag_name.includes('card_mcp') || flag.flag_name.includes('metric_cards'));
    
    ga4Flags.forEach(flag => {
      const status = flag.is_enabled ? '✅ ENABLED' : '❌ DISABLED';
      const percentage = flag.target_audience?.percentage || 0;
      console.log(`${status} ${flag.flag_name} (${percentage}%)`);
      console.log(`   └─ ${flag.description}`);
    });

    // Try to get more database info
    console.log('\n🗄️  Attempting to get more database information...');
    
    // Try to query some known tables
    const knownTables = ['users', 'accounts', 'performance_metrics', 'recommendations'];
    let tableCount = 1; // We know feature_flags exists
    
    for (const tableName of knownTables) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('count', { count: 'exact', head: true });
        
        if (!error) {
          tableCount++;
          console.log(`✅ Found table: ${tableName}`);
        }
      } catch (e) {
        console.log(`❌ Table not found: ${tableName}`);
      }
    }

    console.log(`\n📊 Database Summary:`);
    console.log(`  • At least ${tableCount} tables found`);
    console.log(`  • ${flags.length} total feature flags`);
    console.log(`  • ${ga4Flags.filter(f => f.is_enabled).length}/${ga4Flags.length} GA4 metric flags enabled`);
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    
    if (error.message.includes('JWT')) {
      console.error('🔑 This might be an authentication issue. Make sure your Supabase keys are correct.');
    }
    
    process.exit(1);
  }
}

checkDatabase();