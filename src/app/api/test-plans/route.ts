import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  console.log('🧪 Testing subscription plans...');
  
  // Using imported supabase client

  try {
    // Get all subscription plans
    console.log('🔍 Fetching all subscription plans...');
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('name');

    if (plansError) {
      console.error('❌ Error fetching plans:', plansError);
      return NextResponse.json({ 
        error: 'Failed to fetch plans', 
        details: plansError 
      }, { status: 500 });
    }

    console.log('✅ Plans fetched successfully:', plans);

    // Test specific plan lookups
    const testPlanNames = ['Large Event Org', 'Small Event Org', 'Free', 'Free Trial'];
    const planLookupResults: Record<string, any> = {};

    for (const planName of testPlanNames) {
      console.log(`🔍 Testing lookup for plan: "${planName}"`);
      
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('name', planName)
        .single();

      planLookupResults[planName] = {
        found: !!planData && !planError,
        data: planData,
        error: planError
      };

      if (planData) {
        console.log(`✅ Plan "${planName}" found:`, planData);
      } else {
        console.log(`❌ Plan "${planName}" not found:`, planError);
      }
    }

    return NextResponse.json({ 
      success: true,
      allPlans: plans,
      planLookupResults: planLookupResults,
      totalPlans: plans?.length || 0
    });

  } catch (error) {
    console.error('❌ Test plans error:', error);
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error 
    }, { status: 500 });
  }
}
