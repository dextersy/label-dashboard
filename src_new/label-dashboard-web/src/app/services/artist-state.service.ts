import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Artist } from '../components/artist/artist-selection/artist-selection.component';

@Injectable({
  providedIn: 'root'
})
export class ArtistStateService {
  private selectedArtistSubject = new BehaviorSubject<Artist | null>(null);
  public selectedArtist$ = this.selectedArtistSubject.asObservable();

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
}