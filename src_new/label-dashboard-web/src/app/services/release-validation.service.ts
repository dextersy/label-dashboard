import { Injectable } from '@angular/core';
import { ArtistRelease } from '../components/artist/artist-releases-tab/artist-releases-tab.component';
import { Song } from './song.service';

export interface ValidationError {
  message: string;
  trackNumbers?: number[];
}

export interface ValidationWarning {
  message: string;
  description: string;
  trackNumbers?: number[];
}

export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ReleaseValidationService {

  validateRelease(release: ArtistRelease | null, songs?: Song[], validateReleaseInfo: boolean = true): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!release) {
      return {
        errors,
        warnings,
        hasErrors: false,
        hasWarnings: false
      };
    }

    // Release-level validations (only if validateReleaseInfo is true)
    if (validateReleaseInfo) {
      // Error: No cover art
      if (!release.cover_art) {
        errors.push({
          message: 'No cover art'
        });
      }

      // Warning: No release description
      const description = release.description;
      if (!description || description === 'null') {
        warnings.push({
          message: 'No release description',
          description: 'This will help us pitch your track for promotion.'
        });
      }

      // Warning: No liner notes
      const linerNotes = release.liner_notes;
      if (!linerNotes || linerNotes === 'null') {
        warnings.push({
          message: 'No liner notes',
          description: 'Liner notes recognize people who have pitched in.'
        });
      }
    }

    // Song-level validations (only if songs parameter was provided)
    if (songs !== undefined) {
      // Error: No tracks in the release
      if (songs.length === 0) {
        errors.push({
          message: 'No tracks in tracklist'
        });
      } else {
        // Check for songs without authors
        const songsWithoutAuthors = songs
          .filter(song => {
            const hasAuthors = song.authors && song.authors.length > 0;
            return !hasAuthors;
          })
          .map(song => song.track_number || 0);

        if (songsWithoutAuthors.length > 0) {
          errors.push({
            message: 'No authors',
            trackNumbers: songsWithoutAuthors
          });
        }

        // Check for songs without composers
        const songsWithoutComposers = songs
          .filter(song => {
            const hasComposers = song.composers && song.composers.length > 0;
            return !hasComposers;
          })
          .map(song => song.track_number || 0);

        if (songsWithoutComposers.length > 0) {
          errors.push({
            message: 'No composers',
            trackNumbers: songsWithoutComposers
          });
        }

        // Check for songs without audio master (error)
        const songsWithoutAudio = songs
          .filter(song => !song.audio_file || song.audio_file.trim() === '')
          .map(song => song.track_number || 0);

        if (songsWithoutAudio.length > 0) {
          errors.push({
            message: 'No audio master',
            trackNumbers: songsWithoutAudio
          });
        }

        // Check for songs without lyrics (warning)
        const songsWithoutLyrics = songs
          .filter(song => !song.lyrics || song.lyrics.trim() === '')
          .map(song => song.track_number || 0);

        if (songsWithoutLyrics.length > 0) {
          warnings.push({
            message: 'No lyrics',
            description: 'Lyrics help with music discovery and streaming platform features.',
            trackNumbers: songsWithoutLyrics
          });
        }
      }
    }

    return {
      errors,
      warnings,
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0
    };
  }

  getTooltipMessage(validationResult: ValidationResult): string {
    if (!validationResult.hasErrors && !validationResult.hasWarnings) {
      return '';
    }

    const lines: string[] = [];

    // Add errors
    if (validationResult.hasErrors) {
      lines.push('ERRORS:');
      validationResult.errors.forEach(error => {
        if (error.trackNumbers && error.trackNumbers.length > 0) {
          lines.push(`• ${error.message} - Track${error.trackNumbers.length > 1 ? 's' : ''} ${error.trackNumbers.join(', ')}`);
        } else {
          lines.push(`• ${error.message}`);
        }
      });
      lines.push('');
    }

    // Add warnings
    if (validationResult.hasWarnings) {
      lines.push('WARNINGS:');
      validationResult.warnings.forEach(warning => {
        if (warning.trackNumbers && warning.trackNumbers.length > 0) {
          lines.push(`• ${warning.message} - Track${warning.trackNumbers.length > 1 ? 's' : ''} ${warning.trackNumbers.join(', ')}`);
        } else {
          lines.push(`• ${warning.message}`);
        }
        lines.push(`  ${warning.description}`);
      });
      lines.push('');
    }

    // Add action message
    if (validationResult.hasErrors) {
      lines.push('You need to fix the issues before submitting.');
    } else if (validationResult.hasWarnings) {
      lines.push('You can still submit this release but we recommend fixing the issues.');
    }

    return lines.join('\n');
  }
}
