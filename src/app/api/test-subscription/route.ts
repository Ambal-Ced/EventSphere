import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionService } from '@/lib/subscription';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, planName } = body;

    console.log('🧪 Testing subscription creation:', { userId, planName });

    const subscription = await SubscriptionService.createSubscription(
      userId,
      planName,
      'test-payment-intent-id',
      'test-payment-method-id'
    );

    if (subscription) {
      console.log('✅ Test subscription created successfully:', subscription);
      return NextResponse.json({
        success: true,
        subscription: subscription
      });
    } else {
      console.log('❌ Test subscription creation failed');
      return NextResponse.json({
        success: false,
        error: 'Failed to create subscription'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Test subscription creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
