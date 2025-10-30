import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SongCollaborator {
  id?: number;
  artist_id: number;
  role?: string;
  artist?: any;
}

export interface SongAuthor {
  id?: number;
  name: string;
  pro_affiliation?: string;
  ipi_number?: string;
  share_percentage?: number;
}

export interface SongComposer {
  id?: number;
  name: string;
  pro_affiliation?: string;
  ipi_number?: string;
  share_percentage?: number;
}

export interface Song {
  id?: number;
  release_id: number;
  title: string;
  track_number?: number;
  duration?: number;
  lyrics?: string;
  audio_file?: string;
  isrc?: string;
  spotify_link?: string;
  apple_music_link?: string;
  youtube_link?: string;
  collaborators?: SongCollaborator[];
  authors?: SongAuthor[];
  composers?: SongComposer[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SongFormData {
  release_id: number;
  title: string;
  track_number?: number;
  duration?: number;
  lyrics?: string;
  isrc?: string;
  spotify_link?: string;
  apple_music_link?: string;
  youtube_link?: string;
  collaborators?: SongCollaborator[];
  authors?: SongAuthor[];
  composers?: SongComposer[];
}

@Injectable({
  providedIn: 'root'
})
export class SongService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  getSongsByRelease(releaseId: number): Observable<{ songs: Song[] }> {
    return this.http.get<{ songs: Song[] }>(
      `${this.baseUrl}/songs/release/${releaseId}`,
      { headers: this.getAuthHeaders() }
    );
  }

  getSong(id: number): Observable<{ song: Song }> {
    return this.http.get<{ song: Song }>(
      `${this.baseUrl}/songs/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  createSong(songData: SongFormData): Observable<{ song: Song }> {
    return this.http.post<{ song: Song }>(
      `${this.baseUrl}/songs`,
      songData,
      { headers: this.getAuthHeaders() }
    );
  }

  updateSong(id: number, songData: Partial<SongFormData>): Observable<{ song: Song }> {
    return this.http.put<{ song: Song }>(
      `${this.baseUrl}/songs/${id}`,
      songData,
      { headers: this.getAuthHeaders() }
    );
  }

  deleteSong(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/songs/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  uploadAudio(songId: number, audioFile: File): Observable<{ message: string; audio_file: string }> {
    const formData = new FormData();
    formData.append('audio', audioFile);

    const token = localStorage.getItem('auth_token');
    const headers = new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
    });

    return this.http.post<{ message: string; audio_file: string }>(
      `${this.baseUrl}/songs/${songId}/audio`,
      formData,
      { headers }
    );
  }

  reorderSongs(releaseId: number, songOrder: number[]): Observable<{ songs: Song[] }> {
    return this.http.put<{ songs: Song[] }>(
      `${this.baseUrl}/songs/release/${releaseId}/reorder`,
      { songOrder },
      { headers: this.getAuthHeaders() }
    );
  }
}
