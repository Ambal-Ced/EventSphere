import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionNotificationService } from '@/lib/subscription-notification-service';

export async function POST(request: NextRequest) {
  try {
    // Check for API key or other authentication if needed
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET || 'default-secret';
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Running subscription expiry check...');
    
    // Check for expiring subscriptions and send notifications
    await SubscriptionNotificationService.checkAndNotifyExpiringSubscriptions();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Subscription expiry check completed' 
    });
  } catch (error) {
    console.error('❌ Error in subscription expiry check:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// Allow GET for testing purposes
export async function GET() {
  try {
    console.log('🔄 Running subscription expiry check (GET)...');
    
    await SubscriptionNotificationService.checkAndNotifyExpiringSubscriptions();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Subscription expiry check completed' 
    });
  } catch (error) {
    console.error('❌ Error in subscription expiry check:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
