import { Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AudioPlayerService, AudioPlayerState } from '../../../services/audio-player.service';

@Component({
  selector: 'app-audio-player-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audio-player-popup.component.html',
  styleUrls: ['./audio-player-popup.component.scss']
})
export class AudioPlayerPopupComponent implements OnInit, OnDestroy {
  @ViewChild('progressBar') progressBar!: ElementRef<HTMLDivElement>;

  state: AudioPlayerState | null = null;
  isVisible: boolean = false;
  isDragging: boolean = false;

  private subscription: Subscription | null = null;
  // Store references for cleanup to prevent memory leaks
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseUpHandler: (() => void) | null = null;

  constructor(
    public audioPlayerService: AudioPlayerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscription = this.audioPlayerService.state$.subscribe(state => {
      this.state = state;
      // Show popup when playing or paused, hide when stopped
      this.isVisible = state.isPlaying || state.isPaused || state.isLoading;
      // Force change detection as state changes come from outside Angular zone
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    // Clean up any active drag event listeners to prevent memory leaks
    this.cleanupDragListeners();
  }

  private cleanupDragListeners(): void {
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }
    if (this.mouseUpHandler) {
      document.removeEventListener('mouseup', this.mouseUpHandler);
      this.mouseUpHandler = null;
    }
    this.isDragging = false;
  }

  togglePlayPause(): void {
    if (this.state?.isPlaying) {
      this.audioPlayerService.pause();
    } else if (this.state?.isPaused && this.state.currentTrack) {
      this.audioPlayerService.resume();
    }
  }

  /**
   * Close the player and perform extensive cleanup to avoid memory leaks.
   * This stops audio playback, clears all callbacks, and cleans up event listeners.
   */
  close(): void {
    // Clean up drag listeners first
    this.cleanupDragListeners();
    
    // Stop audio playback and clean up all audio resources
    this.audioPlayerService.stop();
    
    // Clear any registered callbacks to prevent stale closures
    this.audioPlayerService.clearCallbacks();
    
    // Hide the player immediately
    this.isVisible = false;
  }

  stop(): void {
    this.audioPlayerService.stop();
  }

  onProgressBarClick(event: MouseEvent): void {
    if (!this.progressBar) return;

    const rect = this.progressBar.nativeElement.getBoundingClientRect();
    const percentage = ((event.clientX - rect.left) / rect.width) * 100;
    this.audioPlayerService.seek(Math.max(0, Math.min(100, percentage)));
  }

  onProgressBarMouseDown(event: MouseEvent): void {
    // Clean up any existing listeners first
    this.cleanupDragListeners();
    
    this.isDragging = true;
    this.onProgressBarClick(event);

    this.mouseMoveHandler = (e: MouseEvent) => {
      if (this.isDragging && this.progressBar) {
        const rect = this.progressBar.nativeElement.getBoundingClientRect();
        const percentage = ((e.clientX - rect.left) / rect.width) * 100;
        this.audioPlayerService.seek(Math.max(0, Math.min(100, percentage)));
      }
    };

    this.mouseUpHandler = () => {
      this.cleanupDragListeners();
    };

    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);
  }

  /**
   * Handle keyboard navigation for the progress bar slider.
   * Supports: ArrowLeft/ArrowRight/ArrowUp/ArrowDown (±5%), PageUp/PageDown (±10%), Home (0%), End (100%)
   */
  onProgressBarKeyDown(event: KeyboardEvent): void {
    const currentProgress = this.state?.progress || 0;
    let newProgress: number | null = null;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        // Decrease by 5%
        newProgress = Math.max(0, currentProgress - 5);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        // Increase by 5%
        newProgress = Math.min(100, currentProgress + 5);
        break;
      case 'Home':
        // Jump to start
        newProgress = 0;
        break;
      case 'End':
        // Jump to end
        newProgress = 100;
        break;
      case 'PageDown':
        // Decrease by 10%
        newProgress = Math.max(0, currentProgress - 10);
        break;
      case 'PageUp':
        // Increase by 10%
        newProgress = Math.min(100, currentProgress + 10);
        break;
      default:
        return; // Don't prevent default for other keys
    }

    if (newProgress !== null) {
      event.preventDefault();
      this.audioPlayerService.seek(newProgress);
    }
  }

  formatTime(seconds: number): string {
    return this.audioPlayerService.formatTime(seconds);
  }

  get trackTitle(): string {
    return this.state?.currentTrack?.title || 'Unknown Track';
  }

  get trackArtist(): string {
    return this.state?.currentTrack?.artist_name || '';
  }
}
