export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { paymongoService } from '@/lib/paymongo';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 PayMongo API Route - Request received');
    
    const body = await request.json();
    const { action, ...data } = body;

    console.log('🔧 PayMongo API Route - Action:', action);
    console.log('📊 PayMongo API Route - Data:', {
      ...data,
      // Mask sensitive data
      cardNumber: data.cardNumber ? data.cardNumber.replace(/\d(?=\d{4})/g, '*') : undefined,
      cvc: data.cvc ? '[MASKED]' : undefined
    });

    // Validate required environment variables
    if (!process.env.PAYMONGO_SECRET_KEY) {
      console.error('❌ PAYMONGO_SECRET_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'PayMongo configuration error: Secret key not found' },
        { status: 500 }
      );
    }

    console.log('✅ PayMongo API Route - Environment variables validated');

    switch (action) {
      case 'createPaymentMethod':
        console.log('💳 PayMongo API Route - Creating payment method...');
        const paymentMethodResult = await paymongoService.createPaymentMethod(data);
        console.log('✅ PayMongo API Route - Payment method created successfully');
        return NextResponse.json(paymentMethodResult);

      case 'createPaymentIntent':
        console.log('💰 PayMongo API Route - Creating payment intent...');
        const paymentIntentResult = await paymongoService.createPaymentIntent(data);
        console.log('✅ PayMongo API Route - Payment intent created successfully');
        return NextResponse.json(paymentIntentResult);

      case 'attachPaymentMethod':
        console.log('🔗 PayMongo API Route - Attaching payment method...');
        const attachResult = await paymongoService.attachPaymentMethod(data.paymentIntentId, data.paymentMethodId);
        console.log('✅ PayMongo API Route - Payment method attached successfully');
        return NextResponse.json(attachResult);

      case 'processPayment':
        console.log('🚀 PayMongo API Route - Processing payment...');
        const processResult = await paymongoService.processPayment(data);
        console.log('✅ PayMongo API Route - Payment processed successfully');
        return NextResponse.json(processResult);

      case 'getPaymentIntentStatus':
        console.log('🔍 PayMongo API Route - Getting payment intent status...');
        const statusResult = await paymongoService.getPaymentIntentStatus(data.paymentIntentId);
        console.log('✅ PayMongo API Route - Payment intent status retrieved successfully');
        return NextResponse.json(statusResult);

      default:
        console.error('❌ PayMongo API Route - Invalid action:', action);
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ PayMongo API Route Error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
