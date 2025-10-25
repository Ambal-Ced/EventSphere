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
      publicKeyPrefix: this.config.publicKey.substring(0, 10) + '...',
      secretKeyPrefix: this.config.secretKey.substring(0, 10) + '...',
      secretKeyLength: this.config.secretKey.length
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

    // Validate card data
    const cleanCardNumber = cardData.cardNumber.replace(/\s/g, '');
    console.log('🔍 Card validation:', {
      originalCardNumber: cardData.cardNumber,
      cleanCardNumber: cleanCardNumber,
      cardLength: cleanCardNumber.length,
      expiryMonth: cardData.expiryMonth,
      expiryYear: cardData.expiryYear,
      cvcLength: cardData.cvc.length
    });

    if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
      throw new Error(`Invalid card number length: ${cleanCardNumber.length} (expected 13-19)`);
    }
    
    if (cardData.expiryMonth < 1 || cardData.expiryMonth > 12) {
      throw new Error(`Invalid expiry month: ${cardData.expiryMonth} (expected 1-12)`);
    }
    
    if (cardData.expiryYear < new Date().getFullYear()) {
      throw new Error(`Card has expired: ${cardData.expiryYear} (current year: ${new Date().getFullYear()})`);
    }
    
    if (cardData.cvc.length < 3 || cardData.cvc.length > 4) {
      throw new Error(`Invalid CVC length: ${cardData.cvc.length} (expected 3-4)`);
    }

    console.log('✅ Card data validation passed');

    const paymentMethodData = {
      type: 'payment_method',
      attributes: {
        type: 'card',
        details: {
          card_number: cleanCardNumber, // Use validated clean card number
          exp_month: cardData.expiryMonth,
          exp_year: cardData.expiryYear,
          cvc: cardData.cvc
        },
        billing: cardData.email || cardData.country ? {
          name: cardData.cardholderName,
          email: cardData.email || '',
          address: cardData.country ? {
            country: cardData.country
          } : undefined
        } : undefined
      }
    };

    // Try minimal request first
    const minimalPaymentMethodData = {
      type: 'payment_method',
      attributes: {
        type: 'card',
        details: {
          card_number: cleanCardNumber,
          exp_month: cardData.expiryMonth,
          exp_year: cardData.expiryYear,
          cvc: cardData.cvc
        }
      }
    };

    console.log('📤 PayMongo API Request - Create Payment Method (Minimal):', {
      url: `${this.config.baseUrl}/payment_methods`,
      headers: {
        'Authorization': `Basic ${btoa(this.config.secretKey + ':').substring(0, 20)}...`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: {
        ...minimalPaymentMethodData,
        attributes: {
          ...minimalPaymentMethodData.attributes,
          details: {
            ...minimalPaymentMethodData.attributes.details,
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
          data: minimalPaymentMethodData
        })
      });

      const responseData = await response.json();
      
      console.log('📥 PayMongo API Response - Create Payment Method:', {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });

      // Log detailed error information for debugging
      if (!response.ok && responseData.errors) {
        console.log('🔍 Detailed PayMongo Errors:', JSON.stringify(responseData.errors, null, 2));
      }

      if (!response.ok) {
        console.error('❌ PayMongo API Error - Create Payment Method:', {
          status: response.status,
          statusText: response.statusText,
          errors: responseData.errors,
          fullResponse: responseData
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

    const paymentIntentData = {
      type: 'payment_intent',
      attributes: {
        amount: intentData.amount,
        currency: intentData.currency || 'PHP',
        payment_method_allowed: ['card'],
        payment_method_options: {
          card: {
            request_three_d_secure: 'automatic'
          }
        },
        metadata: intentData.metadata,
        test_mode: this.config.isTestMode // Explicitly set test mode
      }
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
        console.error('❌ PayMongo API Error - Create Payment Intent:', {
          status: response.status,
          statusText: response.statusText,
          errors: responseData.errors,
          fullResponse: responseData
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
            type: 'payment_intent',
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
        console.error('❌ PayMongo API Error - Attach Payment Method:', {
          status: response.status,
          statusText: response.statusText,
          errors: responseData.errors,
          fullResponse: responseData
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
