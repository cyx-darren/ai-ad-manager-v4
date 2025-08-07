import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Test card types and flag mapping
    const cardTypes = ['sessions', 'users', 'bounce-rate', 'conversions'];
    
    const flagTests = cardTypes.map(cardType => {
      const flagName = `${cardType.replace('-', '_')}_card_mcp`;
      return {
        cardType,
        expectedFlag: flagName,
        dashboardCardType: cardType // What's used in dashboard
      };
    });

    // Debug authentication
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Service key available:', !!process.env.SUPABASE_SERVICE_KEY);
    console.log('Anon key available:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    // Get actual flags from database
    const { data: flags, error } = await supabase
      .from('feature_flags')
      .select('flag_name, is_enabled')
      .ilike('flag_name', '%_card_mcp');

    console.log('Supabase query result:', { flags, error });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      cardTypeMappings: flagTests,
      actualFlags: flags,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug flags error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}