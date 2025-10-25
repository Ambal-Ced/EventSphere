import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing PayMongo API connection...');
    
    // Test basic API connection
    const response = await fetch('https://api.paymongo.com/v1/payment_methods', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(process.env.PAYMONGO_SECRET_KEY + ':')}`,
        'Accept': 'application/json'
      }
    });

    console.log('📊 PayMongo API Test Response:', {
      status: response.status,
      statusText: response.statusText
    });

    const data = await response.json();
    console.log('📊 PayMongo API Test Data:', data);

    return NextResponse.json({
      success: true,
      status: response.status,
      data: data
    });
  } catch (error) {
    console.error('❌ PayMongo API Test Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
