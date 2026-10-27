export interface TicketType {
  id: number;
  event_id: number;
  name: string;
  price: number;
  max_tickets: number;
  start_date?: string;
  end_date?: string;
  disabled: boolean;
  special_instructions?: string;
  special_instructions_for_scanner?: string;
  sold_tickets?: number;
  pending_tickets?: number;
  remaining_tickets?: number | null;
  days?: { id: number; date_and_time: string; label?: string | null }[];
  valid_days?: { id: number; date_and_time: string; label?: string | null }[];
}

export interface TicketTypeFormData {
  name: string;
  price: number;
  max_tickets?: number;
  start_date?: string;
  end_date?: string;
  disabled?: boolean;
  special_instructions?: string;
  special_instructions_for_scanner?: string;
}
