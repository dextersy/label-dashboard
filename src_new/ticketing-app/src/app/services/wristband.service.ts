import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  WristbandColor,
  WristbandOrder,
  EventWristbandSettings,
  SavedDeliveryAddress,
  EventAddOnPayment,
} from '../models/wristband.model';

@Injectable({ providedIn: 'root' })
export class WristbandService {
  private readonly eventsBase = `${environment.apiUrl}/events`;
  private readonly addressBase = `${environment.apiUrl}/delivery-addresses`;

  constructor(private http: HttpClient) {}

  // ─── Colors ──────────────────────────────────────────────────────────────

  getWristbandColors(): Observable<WristbandColor[]> {
    return this.http.get<WristbandColor[]>(`${this.eventsBase}/wristband-colors`);
  }

  // ─── Delivery Settings ───────────────────────────────────────────────────

  getWristbandSettings(eventId: number): Observable<EventWristbandSettings> {
    return this.http.get<{ settings: EventWristbandSettings }>(`${this.eventsBase}/wristband-settings`, {
      params: new HttpParams().set('event_id', eventId),
    }).pipe(map(r => r.settings));
  }

  upsertWristbandSettings(
    eventId: number,
    data: {
      delivery_name?: string | null;
      delivery_street?: string | null;
      delivery_city?: string | null;
      delivery_country?: string | null;
      delivery_zip?: string | null;
      delivery_phone?: string | null;
    }
  ): Observable<EventWristbandSettings> {
    return this.http.put<{ settings: EventWristbandSettings }>(
      `${this.eventsBase}/wristband-settings`,
      data,
      { params: new HttpParams().set('event_id', eventId) }
    ).pipe(map(r => r.settings));
  }

  // ─── Orders ──────────────────────────────────────────────────────────────

  getWristbandOrders(eventId: number): Observable<WristbandOrder[]> {
    return this.http.get<{ orders: WristbandOrder[] }>(`${this.eventsBase}/wristband-orders`, {
      params: new HttpParams().set('event_id', eventId),
    }).pipe(map(r => r.orders));
  }

  createWristbandOrder(eventId: number, formData: FormData): Observable<WristbandOrder> {
    return this.http.post<{ order: WristbandOrder }>(`${this.eventsBase}/wristband-orders`, formData, {
      params: new HttpParams().set('event_id', eventId),
    }).pipe(map(r => r.order));
  }

  updateWristbandOrder(id: number, formData: FormData): Observable<WristbandOrder> {
    return this.http.put<{ order: WristbandOrder }>(`${this.eventsBase}/wristband-orders/${id}`, formData).pipe(map(r => r.order));
  }

  deleteWristbandOrder(id: number): Observable<any> {
    return this.http.delete(`${this.eventsBase}/wristband-orders/${id}`);
  }

  getDesignUrl(orderId: number): string {
    return `${this.eventsBase}/wristband-orders/${orderId}/design`;
  }

  // ─── Payments ────────────────────────────────────────────────────────────

  getAddOnPayments(eventId: number): Observable<{ payments: EventAddOnPayment[]; total_paid: number }> {
    return this.http.get<{ payments: EventAddOnPayment[]; total_paid: number }>(
      `${this.eventsBase}/addon-payments`,
      { params: new HttpParams().set('event_id', eventId) }
    );
  }

  createAddOnPayment(data: { event_id: number; amount: number; method: 'balance' | 'paymongo'; notes?: string }): Observable<{ payment: EventAddOnPayment }> {
    return this.http.post<{ payment: EventAddOnPayment }>(`${this.eventsBase}/addon-payments`, data);
  }

  initiateAddOnPayment(data: { event_id: number; amount: number; notes?: string }): Observable<{ payment_id: number; checkout_url: string }> {
    return this.http.post<{ payment_id: number; checkout_url: string }>(`${this.eventsBase}/addon-payments/initiate`, data);
  }

  downloadAddOnInvoicePdf(eventId: number): Observable<Blob> {
    return this.http.get(`${this.eventsBase}/addon-payments/invoice/${eventId}/pdf`, { responseType: 'blob' });
  }

  // ─── Saved Delivery Addresses ────────────────────────────────────────────

  getSavedDeliveryAddresses(): Observable<SavedDeliveryAddress[]> {
    return this.http.get<{ addresses: SavedDeliveryAddress[] }>(this.addressBase).pipe(map(r => r.addresses));
  }

  createSavedDeliveryAddress(data: {
    label?: string | null;
    name?: string | null;
    street?: string | null;
    city?: string | null;
    country?: string | null;
    zip?: string | null;
    phone?: string | null;
  }): Observable<SavedDeliveryAddress> {
    return this.http.post<{ address: SavedDeliveryAddress }>(this.addressBase, data).pipe(map(r => r.address));
  }

  updateSavedDeliveryAddress(
    id: number,
    data: {
      label?: string | null;
      name?: string | null;
      street?: string | null;
      city?: string | null;
      country?: string | null;
      zip?: string | null;
      phone?: string | null;
    }
  ): Observable<SavedDeliveryAddress> {
    return this.http.put<{ address: SavedDeliveryAddress }>(`${this.addressBase}/${id}`, data).pipe(map(r => r.address));
  }

  deleteSavedDeliveryAddress(id: number): Observable<any> {
    return this.http.delete(`${this.addressBase}/${id}`);
  }
}
