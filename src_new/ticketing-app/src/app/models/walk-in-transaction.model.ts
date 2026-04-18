export interface WalkInTransactionItem {
  id: number;
  walk_in_transaction_id: number;
  walk_in_type_id: number;
  walk_in_type_name?: string;
  quantity: number;
  price_per_unit: number;
}

export interface WalkInTransaction {
  id: number;
  event_id: number;
  payment_method: 'cash' | 'gcash' | 'card';
  payment_reference?: string;
  total_amount: number;
  registered_by: number;
  registered_by_name?: string;
  items?: WalkInTransactionItem[];
  created_at?: string;
}
