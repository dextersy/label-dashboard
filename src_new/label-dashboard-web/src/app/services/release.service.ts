import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, forkJoin, map, catchError, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { BrandService, BrandSettings } from './brand.service';

export interface ReleaseFormData {
  title: string;
  catalog_no: string;
  UPC?: string;
  spotify_link?: string;
  apple_music_link?: string;
  youtube_link?: string;
  release_date: string;
  description?: string;
  liner_notes?: string;
  cover_art?: File;
  status?: 'Draft' | 'For Submission' | 'Pending' | 'Live' | 'Taken Down';
  artists?: Array<{
    artist_id: number;
    streaming_royalty_percentage: number;
    sync_royalty_percentage: number;
    download_royalty_percentage: number;
    physical_royalty_percentage: number;
  }>;
}

export interface Release {
  id: number;
  title: string;
  catalog_no: string;
  UPC?: string;
  spotify_link?: string;
  apple_music_link?: string;
  youtube_link?: string;
  cover_art?: string;
  release_date: string;
  status: 'Draft' | 'For Submission' | 'Pending' | 'Live' | 'Taken Down';
  description?: string;
  liner_notes?: string;
  brand_id: number;
  artists?: any[];
  earnings?: any[];
  expenses?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class ReleaseService {
  private baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private brandService: BrandService
  ) { }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  private getFormDataHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  getReleases(): Observable<{ releases: Release[] }> {
    return this.http.get<{ releases: Release[] }>(`${this.baseUrl}/releases`, {
      headers: this.getAuthHeaders()
    });
  }

  getRelease(id: number): Observable<{ release: Release }> {
    return this.http.get<{ release: Release }>(`${this.baseUrl}/releases/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  createRelease(releaseData: ReleaseFormData): Observable<{ message: string; release: Release }> {
    const formData = new FormData();
    
    formData.append('title', releaseData.title);
    formData.append('catalog_no', releaseData.catalog_no);
    formData.append('release_date', releaseData.release_date);
    
    if (releaseData.UPC) formData.append('UPC', releaseData.UPC);
    if (releaseData.spotify_link) formData.append('spotify_link', releaseData.spotify_link);
    if (releaseData.apple_music_link) formData.append('apple_music_link', releaseData.apple_music_link);
    if (releaseData.youtube_link) formData.append('youtube_link', releaseData.youtube_link);
    if (releaseData.description) formData.append('description', releaseData.description);
    if (releaseData.liner_notes) formData.append('liner_notes', releaseData.liner_notes);
    if (releaseData.status) formData.append('status', releaseData.status);
    if (releaseData.cover_art) formData.append('cover_art', releaseData.cover_art);
    
    if (releaseData.artists) {
      formData.append('artists', JSON.stringify(releaseData.artists));
    }

    return this.http.post<{ message: string; release: Release }>(
      `${this.baseUrl}/releases`, 
      formData,
      { headers: this.getFormDataHeaders() }
    );
  }

  updateRelease(id: number, releaseData: Partial<ReleaseFormData>): Observable<{ message: string; release: Release }> {
    const formData = new FormData();
    
    if (releaseData.title) formData.append('title', releaseData.title);
    if (releaseData.UPC !== undefined) formData.append('UPC', releaseData.UPC);
    if (releaseData.spotify_link !== undefined) formData.append('spotify_link', releaseData.spotify_link);
    if (releaseData.apple_music_link !== undefined) formData.append('apple_music_link', releaseData.apple_music_link);
    if (releaseData.youtube_link !== undefined) formData.append('youtube_link', releaseData.youtube_link);
    if (releaseData.release_date) formData.append('release_date', releaseData.release_date);
    if (releaseData.description !== undefined) formData.append('description', releaseData.description);
    if (releaseData.liner_notes !== undefined) formData.append('liner_notes', releaseData.liner_notes);
    if (releaseData.status) formData.append('status', releaseData.status);
    if (releaseData.cover_art) formData.append('cover_art', releaseData.cover_art);
    
    if (releaseData.artists) {
      formData.append('artists', JSON.stringify(releaseData.artists));
    }

    return this.http.put<{ message: string; release: Release }>(
      `${this.baseUrl}/releases/${id}`, 
      formData,
      { headers: this.getFormDataHeaders() }
    );
  }

  deleteRelease(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/releases/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  generateCatalogNumber(): Observable<{ catalog_number: string }> {
    return this.http.get<{ catalog_number: string }>(`${this.baseUrl}/releases/generate-catalog-number`, {
      headers: this.getAuthHeaders()
    });
  }

  downloadMasters(releaseId: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/releases/${releaseId}/download-masters`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob',
      observe: 'response'
    });
  }

  toggleExcludeFromEPK(releaseId: number): Observable<{ success: boolean; exclude_from_epk: boolean; message: string }> {
    return this.http.patch<{ success: boolean; exclude_from_epk: boolean; message: string }>(
      `${this.baseUrl}/releases/${releaseId}/exclude-from-epk`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }
}