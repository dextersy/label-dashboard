export interface WristbandColor {
  id: number;
  slug: string;
  label: string;
  image_path: string;
  bg_color: string;
  available_quantity: number;
  sort_order: number;
}

export interface WristbandOrderItem {
  id: number;
  order_id: number;
  wristband_color_id: number;
  quantity: number;
  color?: WristbandColor;
}

export interface WristbandOrder {
  id: number;
  event_id: number;
  status: 'draft' | 'placed' | 'rejected' | 'confirmed' | 'shipped';
  design_url: string | null;
  design_x: number | null;
  design_y: number | null;
  design_width: number | null;
  design_height: number | null;
  canvas_width: number | null;
  disclaimer_acknowledged: boolean;
  notes: string | null;
  shipping_fee: number | null;
  discount: number | null;
  tracking_url: string | null;
  is_public: boolean;
  created_by: number;
  createdAt: string;
  updatedAt: string;
  items?: WristbandOrderItem[];
}

export interface EventWristbandSettings {
  id?: number;
  event_id: number;
  delivery_name: string | null;
  delivery_street: string | null;
  delivery_city: string | null;
  delivery_country: string | null;
  delivery_zip: string | null;
  delivery_phone: string | null;
}

export interface SavedDeliveryAddress {
  id: number;
  label: string | null;
  name: string | null;
  street: string | null;
  city: string | null;
  country: string | null;
  zip: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface EventAddOnPayment {
  id: number;
  event_id: number;
  amount: number;
  method: 'balance' | 'paymongo';
  status: 'pending' | 'succeeded' | 'failed';
  reference_number: string | null;
  notes: string | null;
  created_by: number;
  createdAt: string;
  updatedAt: string;
  creator?: { id: number; first_name: string; last_name: string; email_address: string };
}
