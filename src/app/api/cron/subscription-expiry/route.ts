export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionService } from '@/lib/subscription';

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Subscription Expiry Cron Job - Starting...');

    // Check for API key or other authentication if needed
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron job request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run the auto-cancellation process
    const result = await SubscriptionService.autoCancelExpiredSubscriptions();
    
    console.log('✅ Subscription Expiry Cron Job - Completed:', result);

    return NextResponse.json({
      success: true,
      message: 'Auto-cancellation completed',
      result: {
        cancelled: result.cancelled,
        errors: result.errors,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Subscription Expiry Cron Job Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Allow POST requests as well for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}