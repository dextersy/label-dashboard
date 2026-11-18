import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SearchResultEvent {
  id: number;
  title: string;
  date_and_time: string;
  venue: string;
  poster_url: string | null;
  brand_name: string | null;
}

export interface SearchResultOrganizer {
  id: number;
  brand_name: string;
  logo_url: string | null;
}

export interface SearchResultPerson {
  id: number;
  first_name: string;
  last_name: string | null;
  profile_photo_url: string | null;
  city: string | null;
}

export interface SearchResults {
  events: SearchResultEvent[];
  organizers: SearchResultOrganizer[];
  people: SearchResultPerson[];
  totals: { events: number; organizers: number; people: number };
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly base = `${environment.apiUrl}/public`;

  constructor(private http: HttpClient) {}

  search(q: string): Observable<SearchResults> {
    const params = new HttpParams().set('q', q);
    return this.http.get<SearchResults>(`${this.base}/search`, { params });
  }
}
