/**
 * PayMongo Integration Service
 * Handles payment processing with comprehensive debugging
 */

interface PayMongoConfig {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
  isTestMode: boolean;
}

interface PaymentMethodData {
  type: 'card';
  attributes: {
    type: 'card';
    details: {
      card_number: string;
      exp_month: number;
      exp_year: number;
      cvc: string;
    };
    billing?: {
      name: string;
      email: string;
      address?: {
        country: string;
      };
    };
  };
}

interface PaymentIntentData {
  amount: number;
  currency: string;
  payment_method_allowed: string[];
  payment_method_options?: {
    card: {
      request_three_d_secure: 'automatic' | 'any' | 'none';
    };
  };
  metadata?: Record<string, string>;
}

interface PayMongoResponse<T = any> {
  data: T;
  errors?: Array<{
    code: string;
    detail: string;
    source?: {
      pointer: string;
    };
  }>;
}

class PayMongoService {
  private config: PayMongoConfig;

  constructor() {
    this.config = {
      publicKey: process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY || '',
      secretKey: process.env.PAYMONGO_SECRET_KEY || '',
      baseUrl: process.env.NEXT_PUBLIC_PAYMONGO_BASE_URL || 'https://api.paymongo.com/v1',
      isTestMode: process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_PAYMONGO_TEST_MODE === 'true'
    };

    console.log('🔧 PayMongo Service initialized:', {
      hasPublicKey: !!this.config.publicKey,
      hasSecretKey: !!this.config.secretKey,
      baseUrl: this.config.baseUrl,
      isTestMode: this.config.isTestMode,
      publicKeyPrefix: this.config.publicKey.substring(0, 10) + '...'
    });
  }

  /**
   * Create a payment method (card tokenization)
   */
  async createPaymentMethod(cardData: {
    cardNumber: string;
    expiryMonth: number;
    expiryYear: number;
    cvc: string;
    cardholderName: string;
    email?: string;
    country?: string;
  }): Promise<PayMongoResponse<{ id: string; type: string; attributes: any }>> {
    console.log('💳 Creating payment method:', {
      cardNumber: cardData.cardNumber.replace(/\d(?=\d{4})/g, '*'), // Mask card number
      expiryMonth: cardData.expiryMonth,
      expiryYear: cardData.expiryYear,
      cardholderName: cardData.cardholderName,
      email: cardData.email,
      country: cardData.country
    });

    const paymentMethodData: PaymentMethodData = {
      type: 'card',
      attributes: {
        type: 'card',
        details: {
          card_number: cardData.cardNumber.replace(/\s/g, ''), // Remove spaces
          exp_month: cardData.expiryMonth,
          exp_year: cardData.expiryYear,
          cvc: cardData.cvc
        },
        billing: {
          name: cardData.cardholderName,
          email: cardData.email || '',
          address: cardData.country ? {
            country: cardData.country
          } : undefined
        }
      }
    };

    console.log('📤 PayMongo API Request - Create Payment Method:', {
      url: `${this.config.baseUrl}/payment_methods`,
      data: {
        ...paymentMethodData,
        attributes: {
          ...paymentMethodData.attributes,
          details: {
            ...paymentMethodData.attributes.details,
            card_number: '[MASKED]',
            cvc: '[MASKED]'
          }
        }
      }
    });

    try {
      const response = await fetch(`${this.config.baseUrl}/payment_methods`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(this.config.secretKey + ':')}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          data: paymentMethodData
        })
      });

      const responseData = await response.json();
      
      console.log('📥 PayMongo API Response - Create Payment Method:', {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });

      if (!response.ok) {
        console.error('❌ PayMongo API Error:', {
          status: response.status,
          statusText: response.statusText,
          errors: responseData.errors
        });
        throw new Error(`PayMongo API Error: ${response.status} ${response.statusText}`);
      }

      return responseData;
    } catch (error) {
      console.error('❌ Error creating payment method:', error);
      throw error;
    }
  }

  /**
   * Create a payment intent
   */
  async createPaymentIntent(intentData: {
    amount: number;
    currency?: string;
    metadata?: Record<string, string>;
  }): Promise<PayMongoResponse<{ id: string; type: string; attributes: any }>> {
    console.log('💰 Creating payment intent:', intentData);

    const paymentIntentData: PaymentIntentData = {
      amount: intentData.amount,
      currency: intentData.currency || 'PHP',
      payment_method_allowed: ['card'],
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic'
        }
      },
      metadata: intentData.metadata
    };

    console.log('📤 PayMongo API Request - Create Payment Intent:', {
      url: `${this.config.baseUrl}/payment_intents`,
      data: paymentIntentData
    });

    try {
      const response = await fetch(`${this.config.baseUrl}/payment_intents`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(this.config.secretKey + ':')}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          data: paymentIntentData
        })
      });

      const responseData = await response.json();
      
      console.log('📥 PayMongo API Response - Create Payment Intent:', {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });

      if (!response.ok) {
        console.error('❌ PayMongo API Error:', {
          status: response.status,
          statusText: response.statusText,
          errors: responseData.errors
        });
        throw new Error(`PayMongo API Error: ${response.status} ${response.statusText}`);
      }

      return responseData;
    } catch (error) {
      console.error('❌ Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Attach payment method to payment intent
   */
  async attachPaymentMethod(paymentIntentId: string, paymentMethodId: string): Promise<PayMongoResponse<any>> {
    console.log('🔗 Attaching payment method to intent:', {
      paymentIntentId,
      paymentMethodId
    });

    console.log('📤 PayMongo API Request - Attach Payment Method:', {
      url: `${this.config.baseUrl}/payment_intents/${paymentIntentId}/attach`,
      data: { payment_method: paymentMethodId }
    });

    try {
      const response = await fetch(`${this.config.baseUrl}/payment_intents/${paymentIntentId}/attach`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(this.config.secretKey + ':')}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          data: {
            attributes: {
              payment_method: paymentMethodId
            }
          }
        })
      });

      const responseData = await response.json();
      
      console.log('📥 PayMongo API Response - Attach Payment Method:', {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });

      if (!response.ok) {
        console.error('❌ PayMongo API Error:', {
          status: response.status,
          statusText: response.statusText,
          errors: responseData.errors
        });
        throw new Error(`PayMongo API Error: ${response.status} ${response.statusText}`);
      }

      return responseData;
    } catch (error) {
      console.error('❌ Error attaching payment method:', error);
      throw error;
    }
  }

  /**
   * Process a complete payment
   */
  async processPayment(paymentData: {
    amount: number;
    currency?: string;
    cardNumber: string;
    expiryMonth: number;
    expiryYear: number;
    cvc: string;
    cardholderName: string;
    email?: string;
    country?: string;
    metadata?: Record<string, string>;
  }): Promise<{
    success: boolean;
    paymentIntentId?: string;
    paymentMethodId?: string;
    error?: string;
    data?: any;
  }> {
    console.log('🚀 Starting payment process:', {
      amount: paymentData.amount,
      currency: paymentData.currency || 'PHP',
      cardholderName: paymentData.cardholderName,
      email: paymentData.email,
      country: paymentData.country,
      metadata: paymentData.metadata
    });

    try {
      // Step 1: Create payment method
      console.log('📝 Step 1: Creating payment method...');
      const paymentMethodResponse = await this.createPaymentMethod({
        cardNumber: paymentData.cardNumber,
        expiryMonth: paymentData.expiryMonth,
        expiryYear: paymentData.expiryYear,
        cvc: paymentData.cvc,
        cardholderName: paymentData.cardholderName,
        email: paymentData.email,
        country: paymentData.country
      });

      if (paymentMethodResponse.errors) {
        console.error('❌ Payment method creation failed:', paymentMethodResponse.errors);
        return {
          success: false,
          error: paymentMethodResponse.errors[0]?.detail || 'Failed to create payment method'
        };
      }

      const paymentMethodId = paymentMethodResponse.data.id;
      console.log('✅ Payment method created:', paymentMethodId);

      // Step 2: Create payment intent
      console.log('📝 Step 2: Creating payment intent...');
      const paymentIntentResponse = await this.createPaymentIntent({
        amount: paymentData.amount,
        currency: paymentData.currency,
        metadata: paymentData.metadata
      });

      if (paymentIntentResponse.errors) {
        console.error('❌ Payment intent creation failed:', paymentIntentResponse.errors);
        return {
          success: false,
          error: paymentIntentResponse.errors[0]?.detail || 'Failed to create payment intent'
        };
      }

      const paymentIntentId = paymentIntentResponse.data.id;
      console.log('✅ Payment intent created:', paymentIntentId);

      // Step 3: Attach payment method to intent
      console.log('📝 Step 3: Attaching payment method to intent...');
      const attachResponse = await this.attachPaymentMethod(paymentIntentId, paymentMethodId);

      if (attachResponse.errors) {
        console.error('❌ Payment method attachment failed:', attachResponse.errors);
        return {
          success: false,
          error: attachResponse.errors[0]?.detail || 'Failed to attach payment method'
        };
      }

      console.log('✅ Payment method attached successfully');

      // Check payment status
      const paymentStatus = attachResponse.data.attributes.status;
      console.log('📊 Payment status:', paymentStatus);

      if (paymentStatus === 'succeeded') {
        console.log('🎉 Payment successful!');
        return {
          success: true,
          paymentIntentId,
          paymentMethodId,
          data: attachResponse.data
        };
      } else if (paymentStatus === 'awaiting_next_action') {
        console.log('⏳ Payment requires additional action (3D Secure)');
        return {
          success: false,
          error: 'Payment requires additional authentication. Please try again.',
          paymentIntentId,
          paymentMethodId,
          data: attachResponse.data
        };
      } else {
        console.log('❌ Payment failed with status:', paymentStatus);
        return {
          success: false,
          error: `Payment failed with status: ${paymentStatus}`,
          paymentIntentId,
          paymentMethodId,
          data: attachResponse.data
        };
      }

    } catch (error) {
      console.error('❌ Payment process failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown payment error'
      };
    }
  }

  /**
   * Get payment intent status
   */
  async getPaymentIntentStatus(paymentIntentId: string): Promise<PayMongoResponse<any>> {
    console.log('🔍 Getting payment intent status:', paymentIntentId);

    try {
      const response = await fetch(`${this.config.baseUrl}/payment_intents/${paymentIntentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(this.config.secretKey + ':')}`,
          'Accept': 'application/json'
        }
      });

      const responseData = await response.json();
      
      console.log('📥 PayMongo API Response - Get Payment Intent:', {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });

      return responseData;
    } catch (error) {
      console.error('❌ Error getting payment intent status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const paymongoService = new PayMongoService();
export default paymongoService;
