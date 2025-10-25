import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { SubscriptionService } from '@/lib/subscription';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Billing History API - Request received');

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No authorization header found');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Extract the token
    const token = authHeader.substring(7);
    
    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ Authentication error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('✅ User authenticated:', user.email);

    // Get billing history
    const billingHistory = await SubscriptionService.getBillingHistory(user.id);
    
    console.log('📊 Billing history retrieved:', billingHistory.length, 'transactions');

    return NextResponse.json({
      success: true,
      data: billingHistory
    });

  } catch (error) {
    console.error('❌ Billing History API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
