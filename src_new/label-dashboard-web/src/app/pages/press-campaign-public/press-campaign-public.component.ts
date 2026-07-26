import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { PressCampaignService } from '../../services/press-campaign.service';
import { PressCampaign } from '../../models/press-campaign.model';
import { IconComponent } from '../../components/shared/icon/icon.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-press-campaign-public',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './press-campaign-public.component.html',
  styleUrl: './press-campaign-public.component.scss',
})
export class PressCampaignPublicComponent implements OnInit {
  campaign: PressCampaign | null = null;
  loading = true;
  notFound = false;
  photosExpanded = false;
  copiedLinkUrl: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private pressCampaignService: PressCampaignService
  ) {}

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.notFound = true;
      this.loading = false;
      return;
    }

    this.pressCampaignService.getPublicCampaign(slug).subscribe({
      next: res => {
        this.campaign = res.campaign;
        this.loading = false;

        // Auto-expand photos if fragment is #photos
        if (window.location.hash === '#photos') {
          this.photosExpanded = true;
          setTimeout(() => {
            document.getElementById('photos-section')?.scrollIntoView({ behavior: 'smooth' });
          }, 300);
        }
      },
      error: err => {
        this.loading = false;
        this.notFound = err.status === 404;
      },
    });
  }

  get effectiveCoverArt(): string | null {
    return this.campaign?.release?.cover_art
      || this.campaign?.event?.poster_url
      || null;
  }

  get releaseSongsWithAudio(): any[] {
    return (this.campaign?.release?.songs || [])
      .filter((s: any) => s.audio_file_mp3)
      .sort((a: any, b: any) => (a.ReleaseSong?.track_number || 0) - (b.ReleaseSong?.track_number || 0));
  }

  songProxyUrl(song: any): string {
    const slug = this.campaign?.public_slug || '';
    return `${environment.apiUrl}/press-campaigns/public/${slug}/download?url=${encodeURIComponent(song.audio_file_mp3)}&filename=${encodeURIComponent(this.audioFileName(song))}`;
  }

  audioFileName(song: any): string {
    const artists = this.campaign?.release?.artists?.map((a: any) => a.name).join(', ')
      || this.campaign?.artist?.name
      || '';
    return `${artists ? artists + ' - ' : ''}${song.title}.mp3`.replace(/[^a-zA-Z0-9\s.\-]/g, '');
  }

  get artistPhotoZipUrl(): string | null {
    if (!this.campaign?.public_slug) return null;
    return `${environment.apiUrl}/press-campaigns/public/${this.campaign.public_slug}/artist-photos.zip`;
  }

  get hasArtists(): boolean {
    if (this.campaign?.campaign_type === 'event') return !!this.campaign?.artist;
    return (this.campaign?.release?.artists?.length || 0) > 0;
  }

  downloadFile(url: string, filename: string): void {
    const slug = this.campaign?.public_slug;
    if (!slug) return;
    const isAbsoluteApi = url.startsWith(environment.apiUrl);
    const fetchUrl = isAbsoluteApi
      ? url
      : `${environment.apiUrl}/press-campaigns/public/${slug}/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    fetch(fetchUrl)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      })
      .catch(err => {
        console.error('Download failed:', err);
        window.open(url, '_blank');
      });
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  getReleaseArtists(): string {
    if (this.campaign?.campaign_type === 'event') {
      return this.campaign?.artist?.name || '';
    }
    return this.campaign?.release?.artists?.map(a => a.name).join(', ') || '';
  }

  getArtistsWithBios(): any[] {
    if (this.campaign?.campaign_type === 'event') {
      return this.campaign?.artist?.bio ? [this.campaign.artist] : [];
    }
    return this.campaign?.release?.artists?.filter((a: any) => a.bio) || [];
  }

  copyLink(url: string): void {
    navigator.clipboard.writeText(url).then(() => {
      this.copiedLinkUrl = url;
      setTimeout(() => (this.copiedLinkUrl = null), 2000);
    });
  }

  get autoLinks(): { label: string; url: string }[] {
    const links: { label: string; url: string }[] = [];
    const release = this.campaign?.release;
    if (release) {
      if (release.spotify_link) links.push({ label: 'Spotify', url: release.spotify_link });
      if (release.apple_music_link) links.push({ label: 'Apple Music', url: release.apple_music_link });
      if (release.youtube_link) links.push({ label: 'YouTube', url: release.youtube_link });
    }
    const event = this.campaign?.event;
    if (event) {
      const ticketUrl = event.buy_shortlink || event.external_ticket_link;
      if (ticketUrl) links.push({ label: 'Buy Tickets', url: ticketUrl });
    }
    return links;
  }
}
