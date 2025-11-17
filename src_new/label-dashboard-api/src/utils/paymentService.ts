import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Brand from '../models/Brand';
import PaymentMethod from '../models/PaymentMethod';
import LabelPaymentMethod from '../models/LabelPaymentMethod';
import { Ticket, Event, User, Domain, TicketType } from '../models';
import { sendTicketEmail } from './ticketEmailService';
import { sendBrandedEmail } from './emailService';
import { calculatePlatformFeeForEventTickets } from './platformFeeCalculator';

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
    payments?: any[];
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
    cancel_url?: string;
    description?: string;
    billing?: {
      name: string;
      email: string;
      phone: string;
    };
  }): Promise<any> {
    try {
      const requestBody: any = {
        data: {
          attributes: {
            line_items: data.line_items,
            payment_method_types: data.payment_method_types,
            success_url: data.success_url,
            send_email_receipt: false,
            show_description: true,
            show_line_items: true
          }
        }
      };

      // Add billing information if provided (to match PHP implementation)
      if (data.billing) {
        requestBody.data.attributes.billing = {
          name: data.billing.name,
          email: data.billing.email,
          phone: data.billing.phone
        };
      }

      // Add optional fields
      if (data.description) {
        requestBody.data.attributes.description = data.description;
      }

      const response = await axios.post(
        `${this.baseUrl}/checkout_sessions`,
        requestBody,
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

  async processWebhook(payload: any, signature?: string): Promise<boolean> {
    try {
      this.webhookLog('Received a webhook event: ' + JSON.stringify(payload));
      
      // Early return for signature verification failure
      if (signature && !this.verifyWebhookSignature(payload, signature)) {
        this.webhookLog('ERROR: Invalid webhook signature');
        await this.sendAdminFailureNotification('Invalid webhook signature', undefined, payload);
        return false;
      }
      
      // Early return for invalid payload structure
      if (!payload.data?.attributes?.data) {
        this.webhookLog('ERROR: Invalid webhook payload structure');
        await this.sendAdminFailureNotification('Invalid JSON data', undefined, payload);
        return false;
      }
      
      const eventData = payload.data.attributes.data;
      const eventType = eventData.type;
      
      // Early return for unsupported event types
      if (eventType !== 'link' && eventType !== 'checkout_session') {
        this.webhookLog('ERROR: Unsupported event type: ' + eventType);
        await this.sendAdminFailureNotification('Unsupported event type: ' + eventType, undefined, payload);
        return false;
      }
      
      this.webhookLog('Valid JSON - type ' + eventType);
      
      // Find ticket based on payment type
      const ticket = await this.findTicketByPaymentType(eventType, eventData);
      
      // Early return if ticket not found
      if (!ticket) {
        this.webhookLog('ERROR: Reference is not valid or ticket not found');
        await this.sendAdminFailureNotification('Invalid reference value in JSON response', undefined, payload);
        return false;
      }
      
      this.webhookLog('Valid reference found for ticket ID: ' + ticket.id);
      
      // Calculate processing fee
      const processingFee = this.calculateProcessingFeeFromPayments(eventType, eventData);

      // Extract payment ID
      const paymentId = this.extractPaymentIdFromPayments(eventType, eventData);

      // Process payment confirmation
      return await this.processPaymentConfirmation(ticket, processingFee, paymentId, payload);
      
    } catch (error) {
      this.webhookLog('ERROR: Exception in processWebhook: ' + (error as Error).message);
      await this.sendAdminFailureNotification('Webhook processing exception: ' + (error as Error).message, undefined, payload);
      console.error('PayMongo webhook processing error:', error);
      return false;
    }
  }
  
  private async findTicketByPaymentType(eventType: string, eventData: any): Promise<any> {
    const includeOptions = [
      { 
        model: Event, 
        as: 'event',
        include: [{ model: Brand, as: 'brand' }]
      }
    ];
    
    if (eventType === 'link') {
      return await Ticket.findOne({
        where: { payment_link_id: eventData.id },
        include: includeOptions
      });
    }
    
    if (eventType === 'checkout_session') {
      // Use the client_key from checkout session to match against checkout_key field
      const clientKey = eventData.attributes?.client_key;
      if (!clientKey) {
        return null;
      }
      
      return await Ticket.findOne({
        where: { checkout_key: clientKey },
        include: includeOptions
      });
    }
    
    return null;
  }
  
  private calculateProcessingFeeFromPayments(eventType: string, eventData: any): number {
    const payments = eventData.attributes?.payments;
    
    if (!payments) {
      return 0;
    }
    
    this.webhookLog('Payments data is available...');
    
    return payments.reduce((total: number, payment: any) => {
      if (eventType === 'checkout_session') {
        return total + ((payment.attributes?.fee || 0) / 100);
      }
      
      if (eventType === 'link') {
        return total + ((payment.data?.attributes?.fee || 0) / 100);
      }
      
      return total;
    }, 0);
  }

  private extractPaymentIdFromPayments(eventType: string, eventData: any): string | null {
    const payments = eventData.attributes?.payments;

    if (!payments || payments.length === 0) {
      return null;
    }

    // Get the first payment's ID
    const payment = payments[0];

    if (eventType === 'checkout_session') {
      return payment.id || payment.attributes?.id || null;
    }

    if (eventType === 'link') {
      return payment.data?.id || payment.id || null;
    }

    return null;
  }

  private async processPaymentConfirmation(ticket: any, processingFee: number, paymentId: string | null, payload?: any): Promise<boolean> {
    // Update ticket payment status
    const paymentUpdated = await this.updateTicketPaymentStatus(ticket.id, processingFee, paymentId);
    
    if (!paymentUpdated) {
      this.webhookLog('ERROR: Failed to update ticket payment verification. id = ' + ticket.id + ', processing_fee = ' + processingFee);
      await this.sendAdminFailureNotification('Ticket payment verification failed. Ticket id = ' + ticket.id, ticket.event?.brand_id, payload);
      return false;
    }
    
    this.webhookLog('Successfully updated ticket payment status');
    
    // Send ticket email
    const ticketSent = await this.sendTicket(ticket.id);
    
    if (!ticketSent) {
      this.webhookLog('ERROR: Failed to send ticket email');
      await this.sendAdminFailureNotification('Failed to send ticket to customer', ticket.event?.brand_id, payload);
      return false;
    }
    
    this.webhookLog('Successfully sent ticket email');
    
    // Reload ticket to get updated processing fee
    const updatedTicket = await Ticket.findOne({
      where: { id: ticket.id },
      include: [
        {
          model: Event,
          as: 'event',
          include: [{ model: Brand, as: 'brand' }]
        },
        { 
          model: TicketType, 
          as: 'ticketType',
          attributes: ['id', 'name']
        }
      ]
    });
    
    if (!updatedTicket) {
      this.webhookLog('ERROR: Failed to reload ticket for admin notification');
      await this.sendAdminFailureNotification('Failed to reload ticket for admin notification', ticket.event?.brand_id, payload);
      return false;
    }
    
    // Send admin notification with updated ticket data
    const adminNotificationSent = await this.sendAdminNotification(updatedTicket.event, updatedTicket);
    
    if (!adminNotificationSent) {
      this.webhookLog('ERROR: Failed to send admin notification');
      await this.sendAdminFailureNotification('Failed to send admin notification email', ticket.event?.brand_id, payload);
      return false;
    }
    
    this.webhookLog('Successfully sent admin notification');
    return true;
  }
  
  private verifyWebhookSignature(payload: any, signature: string): boolean {
    try {
      // PayMongo webhook signature verification
      // This is a placeholder - implement actual signature verification based on PayMongo docs
      return true;
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }
  
  private webhookLog(message: string): void {
    try {
      const timestamp = '[' + new Date().toLocaleString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: true 
      }) + '] ';
      
      const logMessage = timestamp + message + '\n';
      
      // Write to webhook.log file
      const logPath = path.join(process.cwd(), 'webhook.log');
      fs.appendFileSync(logPath, logMessage);
      
      // Also log to console for development
      console.log('WEBHOOK: ' + message);
    } catch (error) {
      console.error('Failed to write webhook log:', error);
    }
  }
  
  async updateTicketPaymentStatus(ticketId: number, processingFee: number, paymentId: string | null = null): Promise<boolean> {
    try {
      const ticket = await Ticket.findByPk(ticketId, {
        include: [
          {
            model: Event,
            as: 'event',
            attributes: ['brand_id'],
            include: [
              {
                model: Brand,
                as: 'brand',
                attributes: ['id']
              }
            ]
          }
        ]
      });
      
      if (!ticket) {
        return false;
      }
      
      // Calculate platform fee with updated processing fee
      const platformFeeCalc = await calculatePlatformFeeForEventTickets(
        ticket.event.brand_id,
        ticket.price_per_ticket || 0,
        ticket.number_of_entries,
        processingFee
      );

      const updateData: any = {
        status: 'Payment Confirmed',
        payment_processing_fee: processingFee,
        platform_fee: platformFeeCalc.totalPlatformFee,
        date_paid: new Date()
      };

      // Add payment_id if available
      if (paymentId) {
        updateData.payment_id = paymentId;
        this.webhookLog('Saving payment_id: ' + paymentId);
      }

      await ticket.update(updateData);

      return true;
    } catch (error) {
      console.error('Failed to update ticket payment status:', error);
      return false;
    }
  }
  
  private async sendTicket(ticketId: number): Promise<boolean> {
    try {
      const ticket = await Ticket.findOne({
        where: { id: ticketId },
        include: [
          { 
            model: Event, 
            as: 'event',
            include: [{ model: Brand, as: 'brand' }]
          },
          { 
            model: TicketType, 
            as: 'ticketType',
            attributes: ['id', 'name']
          }
        ]
      });
      
      if (!ticket || !ticket.event || !ticket.event.brand) {
        return false;
      }
      
      // Send ticket email
      const success = await sendTicketEmail(
        {
          email_address: ticket.email_address,
          name: ticket.name,
          ticket_code: ticket.ticket_code,
          number_of_entries: ticket.number_of_entries,
          ticket_type: (ticket as any).ticketType ? {
            id: (ticket as any).ticketType.id,
            name: (ticket as any).ticketType.name
          } : undefined
        },
        {
          id: ticket.event.id,
          title: ticket.event.title,
          date_and_time: ticket.event.date_and_time,
          venue: ticket.event.venue,
          rsvp_link: ticket.event.rsvp_link,
          venue_address: ticket.event.venue_address,
          venue_latitude: ticket.event.venue_latitude,
          venue_longitude: ticket.event.venue_longitude,
          venue_maps_url: ticket.event.venue_maps_url
        },
        {
          brand_name: ticket.event.brand.brand_name
        },
        ticket.event.brand_id
      );
      
      if (success) {
        // Update ticket status to sent
        await ticket.update({ status: 'Ticket sent.' });
      }
      
      return success;
    } catch (error) {
      console.error('Failed to send ticket:', error);
      return false;
    }
  }
  
  private async getAdminEmails(brandId: number): Promise<string[]> {
    try {
      const admins = await User.findAll({
        where: {
          brand_id: brandId,
          is_admin: true
        },
        attributes: ['email_address']
      });
      
      return admins.map(admin => admin.email_address);
    } catch (error) {
      console.error('Failed to get admin emails:', error);
      return [];
    }
  }
  
  private async sendAdminNotification(event: any, ticket: any): Promise<boolean> {
    try {
      const adminEmails = await this.getAdminEmails(event.brand_id);
      
      if (adminEmails.length === 0) {
        return false;
      }
      
      // Get domain for the brand
      const domains = await Domain.findAll({
        where: { brand_id: event.brand_id }
      });
      
      const domainName = domains.length > 0 ? domains[0].domain_name : 'dashboard.meltrecords.com';
      
      const subject = `New ticket order for ${event.title} completed.`;
      const totalPayment = ticket.price_per_ticket * ticket.number_of_entries;
      
      // Ensure processing fee is a number
      const processingFee = parseFloat(ticket.payment_processing_fee) || 0;
      
      // Create HTML body matching the PHP implementation exactly
      const ticketTypeName = (ticket as any).ticketType ? (ticket as any).ticketType.name : 'Regular';
      const body = `
        Confirmed payment for the following ticket.<br><br>
        Ticket ID : ${ticket.id}<br>
        Name : ${ticket.name}<br>
        Email : ${ticket.email_address}<br>
        Code : ${ticket.ticket_code}<br>
        Number of entries : ${ticket.number_of_entries}<br>
        Ticket Type : ${ticketTypeName}<br>
        Payment : ${totalPayment.toFixed(2)}<br>
        Processing fee : -${processingFee.toFixed(2)}<br>
        <br>
        Go to <a href="https://${domainName}/events#tickets" target="_blank">dashboard</a>
      `;
      
      // Use the simple sendEmail function that accepts HTML directly (matches PHP pattern)
      const { sendEmail } = await import('./emailService');
      
      return await sendEmail(adminEmails, subject, body, event.brand_id);
    } catch (error) {
      console.error('Failed to send admin notification:', error);
      return false;
    }
  }
  
  private async sendAdminFailureNotification(reason: string, brandId?: number, payload?: any): Promise<boolean> {
    try {
      const subject = 'Link payment webhook error detected.';
      let body = `We detected a failed webhook event.<br>Reason: ${reason}`;
      
      // Add preformatted JSON payload if provided
      if (payload) {
        body += `<br><br><strong>Webhook Payload:</strong><br><pre>${JSON.stringify(payload, null, 2)}</pre>`;
      }
      
      // Use the direct sendEmail function for consistency with sendAdminNotification
      const { sendEmail } = await import('./emailService');
      
      // Use provided brandId, or default to brand ID 1 only if no brand context is available
      const targetBrandId = brandId || 1;
      
      // Only send if admin email is configured
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
      if (!adminEmail) {
        console.log('No admin email configured for failure notifications, skipping email');
        return false;
      }
      
      return await sendEmail([adminEmail], subject, body, targetBrandId);
    } catch (error) {
      console.error('Failed to send admin failure notification:', error);
      return false;
    }
  }

  async getWalletBalance(walletId: string): Promise<number> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/wallets/${walletId}`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': this.getAuthHeader()
          }
        }
      );

      return response.data.data.attributes.available_balance / 100; // Convert from cents to pesos
    } catch (error) {
      console.error('PayMongo get wallet balance error:', error);
      return -1;
    }
  }

  async sendMoneyTransfer(
    brandId: number,
    paymentMethodId: number,
    amount: number,
    description: string = '',
    isLabelPayment: boolean = false
  ): Promise<string | null> {
    // Declare paymentMethod at function scope for error logging
    let paymentMethod: any = null;
    let transferAttemptId: string | null = null;

    try {
      // Generate idempotency key to prevent duplicate transfers
      const idempotencyKey = crypto.randomBytes(16).toString('hex');
      transferAttemptId = `${brandId}-${Date.now()}-${idempotencyKey}`;

      console.log(`[Transfer Attempt ID: ${transferAttemptId}] Starting wallet transfer...`);
      // Get brand details
      const brand = await Brand.findByPk(brandId);
      if (!brand || !brand.paymongo_wallet_id) {
        console.error('Brand or wallet ID not found');
        return null;
      }

      // Get payment method details based on payment type
      if (isLabelPayment) {
        paymentMethod = await LabelPaymentMethod.findByPk(paymentMethodId);
      } else {
        paymentMethod = await PaymentMethod.findByPk(paymentMethodId);
      }
      
      if (!paymentMethod || !paymentMethod.bank_code || !paymentMethod.account_name || !paymentMethod.account_number_or_email) {
        console.error('Payment method details incomplete');
        return null;
      }

      // Select provider based on amount:
      // - Use 'pesonet' for amounts greater than 50,000 PHP
      // - Use 'instapay' for amounts 50,000 PHP or less
      const provider = amount > 50000 ? 'pesonet' : 'instapay';

      // Convert amount to cents (Paymongo expects integer amount in cents)
      const amountInCents = Math.round(amount * 100);

      console.log(`[Transfer ${transferAttemptId}] Initiating ${provider} transfer: ₱${amount.toFixed(2)} to ${paymentMethod.bank_code}`);

      // Validate that the bank supports the selected provider
      const supportedBanks = await this.getSupportedBanks(provider);
      if (supportedBanks) {
        const isBankSupported = supportedBanks.some(bank => bank.bank_code === paymentMethod.bank_code);
        if (!isBankSupported) {
          console.error(`Bank code ${paymentMethod.bank_code} is not supported by ${provider}. Supported banks:`,
            supportedBanks.map(b => b.bank_code).join(', '));
          return null;
        }
      }

      const response = await axios.post(
        `${this.baseUrl}/wallets/${brand.paymongo_wallet_id}/transactions`,
        {
          data: {
            attributes: {
              amount: amountInCents, // Amount in cents (integer)
              receiver: {
                bank_account_name: paymentMethod.account_name,
                bank_account_number: paymentMethod.account_number_or_email,
                bank_code: paymentMethod.bank_code
              },
              provider: provider,
              type: 'send_money',
              description: description
            }
          }
        },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': this.getAuthHeader(),
            'Idempotency-Key': idempotencyKey
          },
          timeout: 60000 // 60 second timeout
        }
      );

      const referenceNumber = response.data?.data?.attributes?.reference_number;

      console.log(`[Transfer ${transferAttemptId}] ✓ SUCCESS - Ref: ${referenceNumber}`);

      return referenceNumber;
    } catch (error: any) {
      const provider = amount > 50000 ? 'pesonet' : 'instapay';
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ENOTFOUND';

      console.error(`[Transfer ${transferAttemptId}] ✗ FAILED: ${error.message}`);

      // Critical warning for timeout/network errors - transaction might have succeeded
      if (isTimeout || isNetworkError) {
        console.error(`⚠️  WARNING: Transfer may have succeeded on Paymongo. Check dashboard before retry.`);
      }

      // Log API error details if available
      if (error.response?.data?.errors) {
        console.error('Paymongo error:', error.response.data.errors[0]?.detail || JSON.stringify(error.response.data));
      }

      return null;
    }
  }

  async getSupportedBanks(provider: 'instapay' | 'pesonet' = 'instapay'): Promise<Array<{bank_code: string, bank_name: string}> | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/wallets/receiving_institutions?provider=${provider}`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': this.getAuthHeader()
          }
        }
      );

      return response.data.data.map((bank: any) => ({
        bank_code: bank.attributes.provider_code,
        bank_name: bank.attributes.name
      }));
    } catch (error) {
      console.error(`PayMongo get supported banks error (${provider}):`, error);
      return null;
    }
  }

  async createRefund(paymentId: string, amount: number, reason?: string, notes?: string): Promise<any> {
    try {
      const requestBody: any = {
        data: {
          attributes: {
            payment_id: paymentId,
            amount: Math.round(amount * 100), // Convert to cents
          }
        }
      };

      // Add optional fields
      if (reason) {
        requestBody.data.attributes.reason = reason;
      }
      if (notes) {
        requestBody.data.attributes.notes = notes;
      }

      const response = await axios.post(
        `${this.baseUrl}/refunds`,
        requestBody,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': this.getAuthHeader()
          }
        }
      );

      return response.data.data;
    } catch (error: any) {
      console.error('PayMongo create refund error:', error.response?.data || error);
      throw error;
    }
  }

  async getPaymentIdFromTicket(ticket: any): Promise<string | null> {
    try {
      // Get payment link or checkout session details
      if (ticket.payment_link_id) {
        const linkData = await this.getPaymentLink(ticket.payment_link_id);

        if (linkData?.attributes?.payments && linkData.attributes.payments.length > 0) {
          // Get the payment ID from the first payment
          const payment = linkData.attributes.payments[0];
          return payment.data?.id || payment.id || null;
        }
      }

      if (ticket.checkout_key) {
        // For checkout sessions, we need to retrieve the session first
        const response = await axios.get(
          `${this.baseUrl}/checkout_sessions`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': this.getAuthHeader()
            }
          }
        );

        // Find the checkout session with matching client_key
        const sessions = response.data.data;
        const matchingSession = sessions.find((session: any) =>
          session.attributes.client_key === ticket.checkout_key
        );

        if (matchingSession?.attributes?.payments && matchingSession.attributes.payments.length > 0) {
          const payment = matchingSession.attributes.payments[0];
          return payment.data?.id || payment.id || null;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get payment ID from ticket:', error);
      return null;
    }
  }

  async refundTicket(ticketId: number, reason?: string): Promise<boolean> {
    try {
      const ticket = await Ticket.findByPk(ticketId, {
        include: [
          {
            model: Event,
            as: 'event',
            include: [{ model: Brand, as: 'brand' }]
          }
        ]
      });

      if (!ticket) {
        throw new Error('Ticket not found');
      }

      // Only allow refunds for Payment Confirmed or Ticket sent. statuses
      if (ticket.status !== 'Payment Confirmed' && ticket.status !== 'Ticket sent.') {
        throw new Error('Ticket cannot be refunded in current status');
      }

      // Check if ticket has been claimed
      if (ticket.number_of_claimed_entries > 0) {
        throw new Error('Ticket has been claimed and cannot be refunded');
      }

      // Get payment ID from ticket record (saved during webhook)
      let paymentId = ticket.payment_id;

      // Fallback: try to retrieve payment ID if not saved (for older tickets)
      if (!paymentId) {
        this.webhookLog(`Payment ID not found in ticket ${ticketId}, attempting to retrieve from Paymongo`);
        paymentId = await this.getPaymentIdFromTicket(ticket);
      }

      if (!paymentId) {
        throw new Error('Payment ID not found for ticket. Cannot process refund.');
      }

      // Calculate refund amount (full ticket price)
      const refundAmount = (ticket.price_per_ticket || 0) * ticket.number_of_entries;

      // Create refund via Paymongo
      const refund = await this.createRefund(
        paymentId,
        refundAmount,
        'others',
        `Ticket ID: ${ticketId}, Event: ${ticket.event?.title || 'Unknown'}` + (reason ? `, Reason: ${reason}` : '')
      );

      // Update ticket status to Refunded
      await ticket.update({
        status: 'Refunded'
      });

      this.webhookLog(`Successfully refunded ticket ${ticketId}. Refund ID: ${refund.id}, Payment ID: ${paymentId}`);
      return true;
    } catch (error) {
      console.error('Failed to refund ticket:', error);
      this.webhookLog(`Failed to refund ticket ${ticketId}: ${(error as Error).message}`);
      throw error;
    }
  }
}