export interface Ticket {
  id: number;
  event_id: number;
  ticket_type_id: number;
  ticket_type_name?: string;
  name: string;
  email_address: string;
  contact_number?: string;
  number_of_entries: number;
  number_of_claimed_entries?: number;
  amount: number;
  price_per_ticket?: number;
  payment_processing_fee?: number;
  platform_fee?: number;
  status: 'New' | 'Payment Confirmed' | 'Ticket sent.' | 'Canceled' | 'Refunded';
  ticket_code?: string;
  referrer_id?: number;
  referrer_name?: string;
  order_timestamp?: string;
  date_paid?: string;
  payment_link?: string;
}
