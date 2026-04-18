export interface EventReferrer {
  id: number;
  event_id: number;
  name: string;
  referral_code: string;
  referral_shortlink?: string;
  tickets_sold?: number;
  gross?: number;
  net?: number;
}

export interface ReferrerFormData {
  name: string;
  referral_code: string;
}
