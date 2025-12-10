import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ArtistStateService } from '../services/artist-state.service';

export const artistSelectedGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const artistStateService = inject(ArtistStateService);
  
  // Check if an artist is selected in the service
  const selectedArtist = artistStateService.getSelectedArtist();
  
  // Also check localStorage as a fallback (artist might be selected but page was refreshed)
  const savedArtistId = localStorage.getItem('selected_artist_id');
  
  if (selectedArtist || savedArtistId) {
    return true;
  }
  
  // No artist selected, redirect to artist selection page
  router.navigate(['/artist']);
  return false;
};
