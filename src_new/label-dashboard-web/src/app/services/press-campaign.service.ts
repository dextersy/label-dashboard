import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  PressCampaign,
  PressCampaignArtistPhoto,
  PressCampaignLink,
  PressCampaignPagination,
} from '../models/press-campaign.model';

export interface PressCampaignListResponse {
  campaigns: PressCampaign[];
  pagination: PressCampaignPagination;
}

export interface PressCampaignResponse {
  campaign: PressCampaign;
}

export interface SearchResult<T> {
  [key: string]: T[];
}

@Injectable({ providedIn: 'root' })
export class PressCampaignService {
  private readonly apiUrl = `${environment.apiUrl}/press-campaigns`;

  constructor(private http: HttpClient) {}

  getCampaigns(params: {
    page?: number;
    limit?: number;
    sort_field?: string;
    sort_order?: string;
    title?: string;
    status?: string;
  } = {}): Observable<PressCampaignListResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.sort_field) httpParams = httpParams.set('sort_field', params.sort_field);
    if (params.sort_order) httpParams = httpParams.set('sort_order', params.sort_order);
    if (params.title) httpParams = httpParams.set('title', params.title);
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<PressCampaignListResponse>(this.apiUrl, { params: httpParams });
  }

  getCampaign(id: number): Observable<PressCampaignResponse> {
    return this.http.get<PressCampaignResponse>(`${this.apiUrl}/${id}`);
  }

  createCampaign(data: {
    title: string;
    writeup?: string;
    campaign_type?: 'release' | 'event';
    release_id?: number | null;
    artist_id?: number | null;
    event_id?: number | null;
    status?: string;
  }): Observable<PressCampaignResponse> {
    return this.http.post<PressCampaignResponse>(this.apiUrl, data);
  }

  updateCampaign(id: number, data: Partial<{
    title: string;
    writeup: string;
    campaign_type: 'release' | 'event';
    release_id: number | null;
    artist_id: number | null;
    event_id: number | null;
    status: string;
  }>): Observable<PressCampaignResponse> {
    return this.http.put<PressCampaignResponse>(`${this.apiUrl}/${id}`, data);
  }

  deleteCampaign(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  uploadCoverArt(id: number, file: File): Observable<{ cover_art: string }> {
    const formData = new FormData();
    formData.append('cover_art', file);
    return this.http.post<{ cover_art: string }>(`${this.apiUrl}/${id}/cover-art`, formData);
  }

  uploadMp3(id: number, file: File): Observable<{ mp3_file: string }> {
    const formData = new FormData();
    formData.append('mp3', file);
    return this.http.post<{ mp3_file: string }>(`${this.apiUrl}/${id}/mp3`, formData);
  }

  uploadArtistPhoto(id: number, file: File, label?: string): Observable<{ photo: PressCampaignArtistPhoto }> {
    const formData = new FormData();
    formData.append('photo', file);
    if (label) formData.append('label', label);
    return this.http.post<{ photo: PressCampaignArtistPhoto }>(`${this.apiUrl}/${id}/photos`, formData);
  }

  updateArtistPhotoLabel(id: number, photoId: number, label: string): Observable<{ photo: PressCampaignArtistPhoto }> {
    return this.http.put<{ photo: PressCampaignArtistPhoto }>(`${this.apiUrl}/${id}/photos/${photoId}/label`, { label });
  }

  deleteArtistPhoto(id: number, photoId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}/photos/${photoId}`);
  }

  reorderArtistPhotos(id: number, order: number[]): Observable<{ photos: PressCampaignArtistPhoto[] }> {
    return this.http.put<{ photos: PressCampaignArtistPhoto[] }>(`${this.apiUrl}/${id}/photos/reorder`, { order });
  }

  downloadWordDoc(campaign: PressCampaign): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${campaign.id}/download-word`, { responseType: 'blob' });
  }


  getPublicCampaign(slug: string): Observable<{ campaign: PressCampaign }> {
    return this.http.get<{ campaign: PressCampaign }>(`${this.apiUrl}/public/${slug}`);
  }

  searchReleases(search: string): Observable<{ releases: any[] }> {
    return this.http.get<{ releases: any[] }>(`${this.apiUrl}/search/releases`, {
      params: new HttpParams().set('search', search),
    });
  }

  searchArtists(search: string): Observable<{ artists: any[] }> {
    return this.http.get<{ artists: any[] }>(`${this.apiUrl}/search/artists`, {
      params: new HttpParams().set('search', search),
    });
  }

  searchEvents(search: string): Observable<{ events: any[] }> {
    return this.http.get<{ events: any[] }>(`${this.apiUrl}/search/events`, {
      params: new HttpParams().set('search', search),
    });
  }

  generateWriteup(id: number, tone: string, additionalInstructions?: string): Observable<{ writeup: string }> {
    return this.http.post<{ writeup: string }>(`${this.apiUrl}/${id}/generate-writeup`, { tone, additionalInstructions });
  }

  addCampaignLink(id: number, label: string, url: string): Observable<{ link: PressCampaignLink }> {
    return this.http.post<{ link: PressCampaignLink }>(`${this.apiUrl}/${id}/links`, { label, url });
  }

  updateCampaignLink(id: number, linkId: number, data: { label?: string; url?: string }): Observable<{ link: PressCampaignLink }> {
    return this.http.put<{ link: PressCampaignLink }>(`${this.apiUrl}/${id}/links/${linkId}`, data);
  }

  deleteCampaignLink(id: number, linkId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}/links/${linkId}`);
  }
}
