export interface WalkInType {
  id: number;
  event_id: number;
  name: string;
  price: number;
  max_slots: number;
  sold_count?: number;
  remaining_slots?: number | null;
}

export interface WalkInTypeFormData {
  name: string;
  price: number;
  max_slots: number;
}
