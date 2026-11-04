import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { WristbandColor, WristbandOrder } from '../models/wristband.model';

export interface PublicWristbandOrder extends Omit<WristbandOrder, 'created_by'> {
  created_by: number | null;
  is_public: boolean;
  public_token: string;
  customer_name: string;
  customer_email: string;
  payment_status: 'unpaid' | 'pending' | 'paid' | null;
  tracking_url: string | null;
  event?: {
    id: number;
    wristbandSettings?: {
      delivery_name: string | null;
      delivery_street: string | null;
      delivery_city: string | null;
      delivery_country: string | null;
      delivery_zip: string | null;
      delivery_phone: string | null;
    };
  };
}

export interface PublicOrderUpdatePayload {
  items?: { wristband_color_id: number; quantity: number }[];
  disclaimer_acknowledged?: boolean;
  notes?: string | null;
  design_x?: number | null;
  design_y?: number | null;
  design_width?: number | null;
  design_height?: number | null;
  canvas_width?: number | null;
  delivery_name?: string | null;
  delivery_street?: string | null;
  delivery_city?: string | null;
  delivery_country?: string | null;
  delivery_zip?: string | null;
  delivery_phone?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PublicWristbandService {
  private readonly base = `${environment.apiUrl}/public`;

  constructor(private http: HttpClient) {}

  getColors(): Observable<WristbandColor[]> {
    return this.http.get<{ colors: WristbandColor[] }>(`${this.base}/wristband-colors`)
      .pipe(map(r => r.colors));
  }

  createOrder(name: string, email: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.base}/wristband-orders`, { name, email });
  }

  getOrder(token: string): Observable<PublicWristbandOrder> {
    return this.http.get<{ order: PublicWristbandOrder }>(`${this.base}/wristband-orders/${token}`)
      .pipe(map(r => r.order));
  }

  updateOrder(token: string, payload: PublicOrderUpdatePayload, designFile?: File): Observable<PublicWristbandOrder> {
    const formData = new FormData();
    if (payload.items !== undefined) formData.append('items', JSON.stringify(payload.items));
    if (payload.disclaimer_acknowledged !== undefined) formData.append('disclaimer_acknowledged', String(payload.disclaimer_acknowledged));
    if (payload.notes !== undefined) formData.append('notes', payload.notes ?? '');
    if (payload.design_x !== undefined) formData.append('design_x', String(payload.design_x ?? ''));
    if (payload.design_y !== undefined) formData.append('design_y', String(payload.design_y ?? ''));
    if (payload.design_width !== undefined) formData.append('design_width', String(payload.design_width ?? ''));
    if (payload.design_height !== undefined) formData.append('design_height', String(payload.design_height ?? ''));
    if (payload.canvas_width !== undefined) formData.append('canvas_width', String(payload.canvas_width ?? ''));
    if (payload.delivery_name !== undefined) formData.append('delivery_name', payload.delivery_name ?? '');
    if (payload.delivery_street !== undefined) formData.append('delivery_street', payload.delivery_street ?? '');
    if (payload.delivery_city !== undefined) formData.append('delivery_city', payload.delivery_city ?? '');
    if (payload.delivery_country !== undefined) formData.append('delivery_country', payload.delivery_country ?? '');
    if (payload.delivery_zip !== undefined) formData.append('delivery_zip', payload.delivery_zip ?? '');
    if (payload.delivery_phone !== undefined) formData.append('delivery_phone', payload.delivery_phone ?? '');
    if (designFile) formData.append('design', designFile);

    return this.http.put<{ order: PublicWristbandOrder }>(`${this.base}/wristband-orders/${token}`, formData)
      .pipe(map(r => r.order));
  }

  placeOrder(token: string): Observable<PublicWristbandOrder> {
    return this.http.post<{ order: PublicWristbandOrder }>(`${this.base}/wristband-orders/${token}/place`, {})
      .pipe(map(r => r.order));
  }

  sendReminder(token: string): Observable<void> {
    return this.http.post<void>(`${this.base}/wristband-orders/${token}/remind`, {});
  }

  initiatePayment(token: string): Observable<{ checkout_url: string }> {
    return this.http.post<{ checkout_url: string }>(`${this.base}/wristband-orders/${token}/payment/initiate`, {});
  }

  getDesignUrl(token: string): string {
    return `${this.base}/wristband-orders/${token}/design`;
  }
}
