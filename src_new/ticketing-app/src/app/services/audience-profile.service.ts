import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ConnectionPreview {
  id: number;
  first_name: string;
  profile_photo_url: string | null;
}

export interface FollowedOrganizer {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface PublicUserProfile {
  id: number;
  first_name: string;
  last_name: string | null;
  last_name_initial: string | null;
  profile_photo_url: string | null;
  membership_tier: string;
  city: string | null;
  music_genres: string[];
  connection_count: number;
  connection_previews: ConnectionPreview[];
}

export interface AttendedShow {
  id: number;
  title: string;
  date_and_time: string;
  poster_url: string | null;
}

@Injectable({ providedIn: 'root' })
export class AudienceProfileService {
  private readonly base = `${environment.apiUrl}/public`;

  constructor(private http: HttpClient) {}

  getPublicUserProfile(id: number): Observable<{ user: PublicUserProfile; attended_shows: AttendedShow[]; following: FollowedOrganizer[] }> {
    return this.http.get<{ user: PublicUserProfile; attended_shows: AttendedShow[]; following: FollowedOrganizer[] }>(`${this.base}/people/${id}`);
  }
}
