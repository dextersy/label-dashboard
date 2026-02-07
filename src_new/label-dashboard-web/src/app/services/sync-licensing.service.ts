import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SongForPitch {
  id: number;
  title: string;
  duration?: number;
  isrc?: string;
  lyrics?: string;
  authors?: { id: number }[];
  composers?: { id: number }[];
  release?: {
    id: number;
    title: string;
    cover_art?: string;
    artists?: {
      id: number;
      name: string;
    }[];
  };
}

export interface SyncLicensingPitch {
  id: number;
  brand_id: number;
  title: string;
  description?: string;
  created_by: number;
  createdAt?: string;
  updatedAt?: string;
  creator?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  songs?: SongForPitch[];
}

export interface CreatePitchRequest {
  title: string;
  description?: string;
  song_ids?: number[];
}

export interface UpdatePitchRequest {
  title?: string;
  description?: string;
  song_ids?: number[];
}

export interface PitchPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root'
})
export class SyncLicensingService {
  constructor(private http: HttpClient) {}

  /**
   * Get all sync licensing pitches with pagination
   */
  getPitches(page: number = 1, limit: number = 20): Observable<{ pitches: SyncLicensingPitch[], pagination: PitchPagination }> {
    return this.http.get<{ pitches: SyncLicensingPitch[], pagination: PitchPagination }>(
      `${environment.apiUrl}/sync-licensing?page=${page}&limit=${limit}`
    );
  }

  /**
   * Get a single pitch by ID
   */
  getPitch(id: number): Observable<{ pitch: SyncLicensingPitch }> {
    return this.http.get<{ pitch: SyncLicensingPitch }>(
      `${environment.apiUrl}/sync-licensing/${id}`
    );
  }

  /**
   * Create a new pitch
   */
  createPitch(data: CreatePitchRequest): Observable<{ pitch: SyncLicensingPitch }> {
    return this.http.post<{ pitch: SyncLicensingPitch }>(
      `${environment.apiUrl}/sync-licensing`,
      data
    );
  }

  /**
   * Update a pitch
   */
  updatePitch(id: number, data: UpdatePitchRequest): Observable<{ pitch: SyncLicensingPitch }> {
    return this.http.put<{ pitch: SyncLicensingPitch }>(
      `${environment.apiUrl}/sync-licensing/${id}`,
      data
    );
  }

  /**
   * Delete a pitch
   */
  deletePitch(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${environment.apiUrl}/sync-licensing/${id}`
    );
  }

  /**
   * Search songs to add to a pitch (only songs with master audio)
   */
  searchSongs(search: string = '', limit: number = 20): Observable<{ songs: SongForPitch[] }> {
    return this.http.get<{ songs: SongForPitch[] }>(
      `${environment.apiUrl}/sync-licensing/songs/search?search=${encodeURIComponent(search)}&limit=${limit}`
    );
  }

  /**
   * Download master audio files for a pitch as a zip
   */
  downloadMasters(pitch: SyncLicensingPitch): Observable<Blob> {
    return this._downloadFile(pitch, 'masters', 'download-masters', '.zip');
  }

  /**
   * Download lyrics for a pitch as a text file
   */
  downloadLyrics(pitch: SyncLicensingPitch): Observable<Blob> {
    return this._downloadFile(pitch, 'lyrics', 'download-lyrics', '.txt');
  }

  /**
   * Download B-Sheet for a pitch as an Excel file
   */
  downloadBSheet(pitch: SyncLicensingPitch): Observable<Blob> {
    return this._downloadFile(pitch, 'bsheet', 'download-bsheet', '.xlsx');
  }

  /**
   * Internal method to handle blob fetching and triggering browser download.
   */
  private _downloadFile(pitch: SyncLicensingPitch, suffix: string, endpoint: string, extension: string): Observable<Blob> {
    const url = `${environment.apiUrl}/sync-licensing/${pitch.id}/${endpoint}`;
    const sanitizedTitle = pitch.title
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, '_');
    const filename = `${sanitizedTitle}_${suffix}${extension}`;

    return this.http.get(url, { responseType: 'blob' }).pipe(
      tap((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      })
    );
  }

}
