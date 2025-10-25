/**
 * Client-side PayMongo Service
 * Makes API calls to our server-side PayMongo API route
 */

interface PaymentMethodData {
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  cvc: string;
  cardholderName: string;
  email?: string;
  country?: string;
}

interface PaymentIntentData {
  amount: number;
  currency?: string;
  metadata?: Record<string, string>;
}

interface ProcessPaymentData {
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

class ClientPayMongoService {
  private apiUrl = '/api/paymongo';

  /**
   * Create a payment method (card tokenization)
   */
  async createPaymentMethod(cardData: PaymentMethodData): Promise<PayMongoResponse<{ id: string; type: string; attributes: any }>> {
    console.log('💳 Client: Creating payment method:', {
      cardNumber: cardData.cardNumber.replace(/\d(?=\d{4})/g, '*'),
      expiryMonth: cardData.expiryMonth,
      expiryYear: cardData.expiryYear,
      cardholderName: cardData.cardholderName,
      email: cardData.email,
      country: cardData.country
    });

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'createPaymentMethod',
          ...cardData
        })
      });

      const result = await response.json();
      
      console.log('📥 Client: Payment method response:', {
        status: response.status,
        data: result
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${result.error || 'Unknown error'}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Client: Error creating payment method:', error);
      throw error;
    }
  }

  /**
   * Create a payment intent
   */
  async createPaymentIntent(intentData: PaymentIntentData): Promise<PayMongoResponse<{ id: string; type: string; attributes: any }>> {
    console.log('💰 Client: Creating payment intent:', intentData);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'createPaymentIntent',
          ...intentData
        })
      });

      const result = await response.json();
      
      console.log('📥 Client: Payment intent response:', {
        status: response.status,
        data: result
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${result.error || 'Unknown error'}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Client: Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Attach payment method to payment intent
   */
  async attachPaymentMethod(paymentIntentId: string, paymentMethodId: string): Promise<PayMongoResponse<any>> {
    console.log('🔗 Client: Attaching payment method to intent:', {
      paymentIntentId,
      paymentMethodId
    });

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'attachPaymentMethod',
          paymentIntentId,
          paymentMethodId
        })
      });

      const result = await response.json();
      
      console.log('📥 Client: Attach payment method response:', {
        status: response.status,
        data: result
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${result.error || 'Unknown error'}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Client: Error attaching payment method:', error);
      throw error;
    }
  }

  /**
   * Process a complete payment
   */
  async processPayment(paymentData: ProcessPaymentData): Promise<{
    success: boolean;
    paymentIntentId?: string;
    paymentMethodId?: string;
    error?: string;
    data?: any;
  }> {
    console.log('🚀 Client: Starting payment process:', {
      amount: paymentData.amount,
      currency: paymentData.currency || 'PHP',
      cardholderName: paymentData.cardholderName,
      email: paymentData.email,
      country: paymentData.country,
      metadata: paymentData.metadata
    });

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'processPayment',
          ...paymentData
        })
      });

      const result = await response.json();
      
      console.log('📥 Client: Payment process response:', {
        status: response.status,
        data: result
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${result.error || 'Unknown error'}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Client: Payment process error:', error);
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
    console.log('🔍 Client: Getting payment intent status:', paymentIntentId);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getPaymentIntentStatus',
          paymentIntentId
        })
      });

      const result = await response.json();
      
      console.log('📥 Client: Payment intent status response:', {
        status: response.status,
        data: result
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${result.error || 'Unknown error'}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Client: Error getting payment intent status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const clientPaymongoService = new ClientPayMongoService();
export default clientPaymongoService;
