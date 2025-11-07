import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Artist } from '../components/artist/artist-selection/artist-selection.component';

@Injectable({
  providedIn: 'root'
})
export class ArtistStateService {
  private selectedArtistSubject = new BehaviorSubject<Artist | null>(null);
  public selectedArtist$ = this.selectedArtistSubject.asObservable();

  private refreshArtistsSubject = new Subject<number | null>();
  public refreshArtists$ = this.refreshArtistsSubject.asObservable();

  constructor() {}

  setSelectedArtist(artist: Artist | null): void {
    this.selectedArtistSubject.next(artist);
  }

  updateSelectedArtist(updatedData: Partial<Artist>): void {
    const currentArtist = this.selectedArtistSubject.value;
    if (currentArtist) {
      const updatedArtist = { ...currentArtist, ...updatedData };
      this.selectedArtistSubject.next(updatedArtist);
    }
  }

  getSelectedArtist(): Artist | null {
    return this.selectedArtistSubject.value;
  }

  triggerArtistsRefresh(selectArtistId?: number): void {
    this.refreshArtistsSubject.next(selectArtistId || null);
  }
}