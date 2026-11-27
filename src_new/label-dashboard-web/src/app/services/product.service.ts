import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, ProductArtistSplit, ProductImage } from '../models/product.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getProducts(params: any = {}): Observable<{ products: Product[]; total: number }> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get<{ products: Product[]; total: number }>(
      `${this.baseUrl}/products`,
      { headers: this.getAuthHeaders(), params: httpParams }
    );
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${id}`, { headers: this.getAuthHeaders() });
  }

  createProduct(data: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(`${this.baseUrl}/products`, data, { headers: this.getAuthHeaders() });
  }

  updateProduct(id: number, data: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.baseUrl}/products/${id}`, data, { headers: this.getAuthHeaders() });
  }

  deleteProduct(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/products/${id}`, { headers: this.getAuthHeaders() });
  }

  getProductArtists(productId: number): Observable<ProductArtistSplit[]> {
    return this.http.get<ProductArtistSplit[]>(`${this.baseUrl}/products/${productId}/artists`, { headers: this.getAuthHeaders() });
  }

  setProductArtists(productId: number, artists: Array<{ artist_id: number; merch_royalty_percentage: number; merch_royalty_type: string }>): Observable<ProductArtistSplit[]> {
    return this.http.put<ProductArtistSplit[]>(`${this.baseUrl}/products/${productId}/artists`, { artists }, { headers: this.getAuthHeaders() });
  }

  inheritSplitsFromRelease(productId: number): Observable<ProductArtistSplit[]> {
    return this.http.post<ProductArtistSplit[]>(`${this.baseUrl}/products/${productId}/artists/inherit`, {}, { headers: this.getAuthHeaders() });
  }

  uploadImage(productId: number, file: File): Observable<ProductImage> {
    const formData = new FormData();
    formData.append('image', file);
    const token = localStorage.getItem('auth_token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    return this.http.post<ProductImage>(`${this.baseUrl}/products/${productId}/images`, formData, { headers });
  }

  deleteImage(productId: number, imageId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/products/${productId}/images/${imageId}`, { headers: this.getAuthHeaders() });
  }

  reorderImages(productId: number, imageIds: number[]): Observable<ProductImage[]> {
    return this.http.put<ProductImage[]>(`${this.baseUrl}/products/${productId}/images/reorder`, { image_ids: imageIds }, { headers: this.getAuthHeaders() });
  }

  getProductExpenses(productId: number): Observable<{ product_id: number; total_expenses: number; expenses: any[] }> {
    return this.http.get<any>(`${this.baseUrl}/products/${productId}/expenses`, { headers: this.getAuthHeaders() });
  }
}
