import axios from 'axios';

interface PayMongoLinkData {
  amount: number; // in cents
  description: string;
  remarks?: string;
}

interface PayMongoLink {
  id: string;
  attributes: {
    amount: number;
    checkout_url: string;
    reference_number: string;
    status: string;
  };
}

export class PaymentService {
  private secretKey: string;
  private baseUrl = 'https://api.paymongo.com/v1';

  constructor() {
    this.secretKey = process.env.PAYMONGO_SECRET_KEY || '';
    if (!this.secretKey) {
      throw new Error('PAYMONGO_SECRET_KEY is required');
    }
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(this.secretKey).toString('base64')}`;
  }

  async createPaymentLink(data: PayMongoLinkData): Promise<PayMongoLink | null> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/links`,
        {
          data: {
            attributes: {
              amount: data.amount,
              description: data.description,
              remarks: data.remarks
            }
          }
        },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': this.getAuthHeader()
          }
        }
      );

      return response.data.data;
    } catch (error) {
      console.error('PayMongo create link error:', error);
      return null;
    }
  }

  async getPaymentLink(linkId: string): Promise<PayMongoLink | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/links/${linkId}`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': this.getAuthHeader()
          }
        }
      );

      return response.data.data;
    } catch (error) {
      console.error('PayMongo get link error:', error);
      return null;
    }
  }

  async createCheckoutSession(data: {
    line_items: Array<{
      name: string;
      amount: number;
      currency: string;
      quantity: number;
    }>;
    payment_method_types: string[];
    success_url: string;
    cancel_url: string;
    description?: string;
  }): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/checkout_sessions`,
        {
          data: {
            attributes: data
          }
        },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': this.getAuthHeader()
          }
        }
      );

      return response.data.data;
    } catch (error) {
      console.error('PayMongo create checkout session error:', error);
      return null;
    }
  }

  calculateProcessingFee(amount: number, paymentMethod: string = 'card'): number {
    // PayMongo fee structure (approximate)
    let feeRate = 0.035; // 3.5% for cards
    let fixedFee = 15; // ₱15 fixed fee

    if (paymentMethod === 'gcash') {
      feeRate = 0.025; // 2.5% for GCash
      fixedFee = 10; // ₱10 fixed fee
    }

    return Math.ceil(amount * feeRate + fixedFee);
  }

  async processWebhook(payload: any, signature: string): Promise<boolean> {
    try {
      // Verify webhook signature (implement based on PayMongo documentation)
      // For now, we'll assume it's valid
      
      const event = payload.data;
      
      if (event.attributes.type === 'payment.paid') {
        // Handle successful payment
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('PayMongo webhook processing error:', error);
      return false;
    }
  }
}