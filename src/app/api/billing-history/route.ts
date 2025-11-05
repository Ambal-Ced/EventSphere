import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { SubscriptionService } from '@/lib/subscription';

export const runtime = 'edge';
// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

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
    console.log('📊 Transaction details:', billingHistory.map(t => ({
      invoice_number: t.invoice_number,
      plan_name: t.plan_name,
      original_amount_cents: t.original_amount_cents,
      status: t.status,
      transaction_type: t.transaction_type,
      created_at: t.created_at
    })));

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
