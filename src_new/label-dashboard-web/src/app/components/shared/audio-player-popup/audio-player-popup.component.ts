import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
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

  constructor(public audioPlayerService: AudioPlayerService) {}

  ngOnInit(): void {
    this.subscription = this.audioPlayerService.state$.subscribe(state => {
      this.state = state;
      // Show popup when playing or paused, hide when stopped
      this.isVisible = state.isPlaying || state.isPaused || state.isLoading;
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  togglePlayPause(): void {
    if (this.state?.isPlaying) {
      this.audioPlayerService.pause();
    } else if (this.state?.isPaused && this.state.currentTrack) {
      this.audioPlayerService.resume();
    }
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
    this.isDragging = true;
    this.onProgressBarClick(event);

    const mouseMoveHandler = (e: MouseEvent) => {
      if (this.isDragging && this.progressBar) {
        const rect = this.progressBar.nativeElement.getBoundingClientRect();
        const percentage = ((e.clientX - rect.left) / rect.width) * 100;
        this.audioPlayerService.seek(Math.max(0, Math.min(100, percentage)));
      }
    };

    const mouseUpHandler = () => {
      this.isDragging = false;
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
    };

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
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
