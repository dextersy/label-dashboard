import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-share-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div class="fixed inset-0 bg-black/70" (click)="close.emit()"></div>
      <div class="relative bg-black border-2 border-white/20 shadow-2xl p-6 w-full max-w-sm">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-sm font-black text-white uppercase tracking-widest">Share This Show</h2>
          <button (click)="close.emit()" class="text-white/40 hover:text-white transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Share options -->
        <div class="space-y-2">
          <!-- Facebook -->
          <button (click)="shareToFacebook()" class="w-full flex items-center gap-4 px-4 py-3 border border-white/10 hover:border-white/30 hover:bg-white/5 transition-colors group">
            <div class="w-8 h-8 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <span class="text-sm font-mono text-white/70 group-hover:text-white uppercase tracking-wider transition-colors">Share on Facebook</span>
          </button>

          <!-- X (Twitter) -->
          <button (click)="shareToX()" class="w-full flex items-center gap-4 px-4 py-3 border border-white/10 hover:border-white/30 hover:bg-white/5 transition-colors group">
            <div class="w-8 h-8 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </div>
            <span class="text-sm font-mono text-white/70 group-hover:text-white uppercase tracking-wider transition-colors">Share on X</span>
          </button>

          <!-- Copy link -->
          <button (click)="copyLink()" class="w-full flex items-center gap-4 px-4 py-3 border border-white/10 hover:border-white/30 hover:bg-white/5 transition-colors group">
            <div class="w-8 h-8 flex items-center justify-center flex-shrink-0">
              @if (copied()) {
                <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              } @else {
                <svg class="w-5 h-5 text-white/50 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                </svg>
              }
            </div>
            <span class="text-sm font-mono uppercase tracking-wider transition-colors"
              [class]="copied() ? 'text-green-400' : 'text-white/70 group-hover:text-white'">
              {{ copied() ? 'Link copied!' : 'Copy link' }}
            </span>
          </button>

          <!-- Others (native share) -->
          @if (canNativeShare()) {
            <button (click)="nativeShare()" class="w-full flex items-center gap-4 px-4 py-3 border border-white/10 hover:border-white/30 hover:bg-white/5 transition-colors group">
              <div class="w-8 h-8 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-white/50 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                </svg>
              </div>
              <span class="text-sm font-mono text-white/70 group-hover:text-white uppercase tracking-wider transition-colors">More options</span>
            </button>
          }
        </div>

        <!-- URL display -->
        <div class="mt-5 px-3 py-2 bg-white/5 border border-white/10">
          <p class="text-xs font-mono text-white/30 truncate">{{ url }}</p>
        </div>
      </div>
    </div>
  `
})
export class ShareModalComponent {
  @Input() url = '';
  @Input() title = '';
  @Output() close = new EventEmitter<void>();

  copied = signal(false);

  canNativeShare(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.share;
  }

  shareToFacebook(): void {
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.url)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
  }

  shareToX(): void {
    const text = this.title ? `${this.title} — ` : '';
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(this.url)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.url).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    });
  }

  nativeShare(): void {
    if (navigator.share) {
      navigator.share({ title: this.title, url: this.url }).catch(() => {});
    }
  }
}
