import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Songwriter {
  id: number;
  name: string;
  pro_affiliation?: string;
  ipi_number?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SongwriterService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  searchSongwriters(search?: string): Observable<{ songwriters: Songwriter[] }> {
    let url = `${this.baseUrl}/songwriters`;

    if (search) {
      url += `?search=${encodeURIComponent(search)}`;
    }

    return this.http.get<{ songwriters: Songwriter[] }>(
      url,
      { headers: this.getAuthHeaders() }
    );
  }

  getSongwriter(id: number): Observable<{ songwriter: Songwriter }> {
    return this.http.get<{ songwriter: Songwriter }>(
      `${this.baseUrl}/songwriters/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  createSongwriter(songwriter: { name: string; pro_affiliation?: string; ipi_number?: string }): Observable<{ songwriter: Songwriter }> {
    return this.http.post<{ songwriter: Songwriter }>(
      `${this.baseUrl}/songwriters`,
      songwriter,
      { headers: this.getAuthHeaders() }
    );
  }

  updateSongwriter(id: number, songwriter: Partial<Songwriter>): Observable<{ songwriter: Songwriter }> {
    return this.http.put<{ songwriter: Songwriter }>(
      `${this.baseUrl}/songwriters/${id}`,
      songwriter,
      { headers: this.getAuthHeaders() }
    );
  }

  deleteSongwriter(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/songwriters/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }
}
