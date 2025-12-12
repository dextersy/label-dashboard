import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AudioPlayerState {
  playingSongId: number | null;
  pausedSongId: number | null;
  loadingSongId: number | null;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  progress: number; // 0-100 percentage
  currentTrack: PlayableTrack | null;
}

export interface PlayableTrack {
  id: number;
  audio_file?: string;
  has_audio?: boolean;
  title?: string;
  artist_name?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AudioPlayerService implements OnDestroy {
  private audioElement: HTMLAudioElement | null = null;
  private currentBlobUrl: string | null = null;
  private currentAbortController: AbortController | null = null;
  private audioEndedHandler: (() => void) | null = null;
  private audioErrorHandler: ((e: Event) => void) | null = null;
  private audioTimeUpdateHandler: (() => void) | null = null;
  private audioLoadedMetadataHandler: (() => void) | null = null;

  // State
  private _playingSongId: number | null = null;
  private _pausedSongId: number | null = null;
  private _loadingSongId: number | null = null;
  private _currentTime: number = 0;
  private _duration: number = 0;
  private _currentTrack: PlayableTrack | null = null;

  // Observable state for components to subscribe to
  private stateSubject = new BehaviorSubject<AudioPlayerState>(this.getState());
  public state$: Observable<AudioPlayerState> = this.stateSubject.asObservable();

  // Callbacks for components
  private onEndedCallback: (() => void) | null = null;
  private onErrorCallback: ((error: any) => void) | null = null;

  constructor() {}

  ngOnDestroy(): void {
    this.cleanup();
  }

  // Getters for current state
  get playingSongId(): number | null {
    return this._playingSongId;
  }

  get pausedSongId(): number | null {
    return this._pausedSongId;
  }

  get loadingSongId(): number | null {
    return this._loadingSongId;
  }

  // Helper methods for checking state
  isPlaying(songId: number): boolean {
    return this._playingSongId === songId;
  }

  isPaused(songId: number): boolean {
    return this._pausedSongId === songId;
  }

  isLoading(songId: number): boolean {
    return this._loadingSongId === songId;
  }

  isCurrentlyPlaying(): boolean {
    return this._playingSongId !== null;
  }

  isCurrentlyPaused(): boolean {
    return this._pausedSongId !== null;
  }

  isCurrentlyLoading(): boolean {
    return this._loadingSongId !== null;
  }

  /**
   * Toggle play/pause for a song. Handles all state transitions.
   */
  async togglePlay(song: PlayableTrack, audioUrl?: string): Promise<void> {
    if (!song.audio_file && !song.has_audio) return;

    // If this song is currently playing, pause it
    if (this._playingSongId === song.id) {
      this.pause();
      return;
    }

    // If this song is paused, resume it
    if (this._pausedSongId === song.id && this.audioElement) {
      this.resume();
      return;
    }

    // Otherwise, play this new song
    await this.play(song, audioUrl);
  }

  /**
   * Play a song from the beginning. Will stop any currently playing audio.
   * @param song The song to play
   * @param audioUrl Optional custom audio URL. If not provided, uses the default API endpoint.
   * @param useAuth Whether to use authentication (default: true for internal API, false for public)
   */
  async play(song: PlayableTrack, audioUrl?: string, useAuth: boolean = true): Promise<void> {
    // Stop any currently playing audio
    this.cleanup();

    this._loadingSongId = song.id;
    this.emitState();

    // Create new abort controller for this request
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    try {
      const url = audioUrl || `${environment.apiUrl}/songs/${song.id}/audio`;
      
      const headers: Record<string, string> = {};
      if (useAuth && typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status}`);
      }

      const blob = await response.blob();

      // Check if request was aborted
      if (signal.aborted) {
        this._loadingSongId = null;
        this.emitState();
        return;
      }

      this.currentBlobUrl = URL.createObjectURL(blob);

      // Check again after creating blob URL
      if (signal.aborted) {
        URL.revokeObjectURL(this.currentBlobUrl);
        this.currentBlobUrl = null;
        this._loadingSongId = null;
        this.emitState();
        return;
      }

      // Create and configure audio element
      this.audioElement = new Audio(this.currentBlobUrl);

      // Store event handlers for proper cleanup
      this.audioEndedHandler = () => this.handleEnded();
      this.audioErrorHandler = (e) => this.handleError(e);
      this.audioTimeUpdateHandler = () => this.handleTimeUpdate();
      this.audioLoadedMetadataHandler = () => this.handleLoadedMetadata();

      this.audioElement.addEventListener('ended', this.audioEndedHandler);
      this.audioElement.addEventListener('error', this.audioErrorHandler);
      this.audioElement.addEventListener('timeupdate', this.audioTimeUpdateHandler);
      this.audioElement.addEventListener('loadedmetadata', this.audioLoadedMetadataHandler);

      try {
        await this.audioElement.play();
      } catch (playError) {
        // Handle play() rejection (e.g., autoplay policy, user interaction required)
        console.error('Error starting playback:', playError);
        this._loadingSongId = null;
        this.cleanup();
        this.emitState();
        if (this.onErrorCallback) {
          this.onErrorCallback(playError);
        }
        return;
      }

      this._playingSongId = song.id;
      this._pausedSongId = null;
      this._loadingSongId = null;
      this._currentTrack = song;
      this.currentAbortController = null;
      this.emitState();

    } catch (error) {
      // Check if error is due to abort
      if (error instanceof Error && error.name === 'AbortError') {
        this._loadingSongId = null;
        this.emitState();
        return;
      }

      console.error('Error playing audio:', error);
      this.cleanup();
      
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    }
  }

  /**
   * Play audio from a public EPK endpoint (no auth required)
   */
  async playPublic(song: PlayableTrack, artistId: number): Promise<void> {
    const audioUrl = `${environment.apiUrl}/public/epk/${artistId}/audio/${song.id}`;
    await this.play(song, audioUrl, false);
  }

  /**
   * Pause the currently playing audio
   */
  pause(): void {
    if (this.audioElement && this._playingSongId !== null) {
      this.audioElement.pause();
      this._pausedSongId = this._playingSongId;
      this._playingSongId = null;
      this.emitState();
    }
  }

  /**
   * Resume the paused audio
   */
  resume(): void {
    if (this.audioElement && this._pausedSongId !== null) {
      this.audioElement.play().catch((err) => {
        console.error('Audio playback failed to resume:', err);
      });
      this._playingSongId = this._pausedSongId;
      this._pausedSongId = null;
      this.emitState();
    }
  }

  /**
   * Stop the audio and reset state
   */
  stop(): void {
    this.cleanup();
    this.emitState();
  }

  /**
   * Set callback for when audio ends.
   * The callback is invoked when the current track finishes playing.
   * Note: This callback persists until explicitly cleared via clearCallbacks().
   * Multiple calls will override the previous callback (not add to a list).
   * Ensure you call clearCallbacks() in ngOnDestroy to prevent stale closures.
   */
  onEnded(callback: () => void): void {
    this.onEndedCallback = callback;
  }

  /**
   * Set callback for when an error occurs during audio playback.
   * The callback is invoked when audio fetching or playback fails.
   * Note: This callback persists until explicitly cleared via clearCallbacks().
   * Multiple calls will override the previous callback (not add to a list).
   * Ensure you call clearCallbacks() in ngOnDestroy to prevent stale closures.
   */
  onError(callback: (error: any) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Clear all callbacks
   */
  clearCallbacks(): void {
    this.onEndedCallback = null;
    this.onErrorCallback = null;
  }

  /**
   * Seek to a specific position in the audio (0-100 percentage)
   */
  seek(percentage: number): void {
    if (this.audioElement && this._duration > 0) {
      const time = (percentage / 100) * this._duration;
      this.audioElement.currentTime = time;
      this._currentTime = time;
      this.emitState();
    }
  }

  /**
   * Seek to a specific time in seconds
   */
  seekToTime(seconds: number): void {
    if (this.audioElement) {
      this.audioElement.currentTime = seconds;
      this._currentTime = seconds;
      this.emitState();
    }
  }

  /**
   * Format time in seconds to MM:SS
   */
  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    // Abort any in-flight fetch requests
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    // Remove event listeners
    if (this.audioElement && this.audioEndedHandler) {
      this.audioElement.removeEventListener('ended', this.audioEndedHandler);
      this.audioEndedHandler = null;
    }
    if (this.audioElement && this.audioErrorHandler) {
      this.audioElement.removeEventListener('error', this.audioErrorHandler);
      this.audioErrorHandler = null;
    }
    if (this.audioElement && this.audioTimeUpdateHandler) {
      this.audioElement.removeEventListener('timeupdate', this.audioTimeUpdateHandler);
      this.audioTimeUpdateHandler = null;
    }
    if (this.audioElement && this.audioLoadedMetadataHandler) {
      this.audioElement.removeEventListener('loadedmetadata', this.audioLoadedMetadataHandler);
      this.audioLoadedMetadataHandler = null;
    }

    // Clean up blob URL
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    // Clean up audio element
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }

    // Reset state
    this._playingSongId = null;
    this._pausedSongId = null;
    this._loadingSongId = null;
    this._currentTime = 0;
    this._duration = 0;
    this._currentTrack = null;
  }

  private handleEnded(): void {
    this._playingSongId = null;
    this._pausedSongId = null;
    this._currentTime = 0;
    this.emitState();

    if (this.onEndedCallback) {
      this.onEndedCallback();
    }
  }

  private handleError(e: Event): void {
    console.error('Audio playback error:', e);
    this.cleanup();
    this.emitState();

    if (this.onErrorCallback) {
      this.onErrorCallback(e);
    }
  }

  private handleTimeUpdate(): void {
    if (this.audioElement) {
      this._currentTime = this.audioElement.currentTime;
      this.emitState();
    }
  }

  private handleLoadedMetadata(): void {
    if (this.audioElement) {
      this._duration = this.audioElement.duration;
      this.emitState();
    }
  }

  private getState(): AudioPlayerState {
    const progress = this._duration > 0 ? (this._currentTime / this._duration) * 100 : 0;
    return {
      playingSongId: this._playingSongId,
      pausedSongId: this._pausedSongId,
      loadingSongId: this._loadingSongId,
      isPlaying: this._playingSongId !== null,
      isPaused: this._pausedSongId !== null,
      isLoading: this._loadingSongId !== null,
      currentTime: this._currentTime,
      duration: this._duration,
      progress: progress,
      currentTrack: this._currentTrack
    };
  }

  private emitState(): void {
    this.stateSubject.next(this.getState());
  }
}
