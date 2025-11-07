import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { PublicService, PublicEventsList } from '../../services/public.service';
import { BrandService } from '../../services/brand.service';
import { MetaService } from '../../services/meta.service';

@Component({
  selector: 'app-public-events',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-events.component.html',
  styleUrls: ['./public-events.component.scss']
})
export class PublicEventsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  eventsList: PublicEventsList | null = null;
  isLoading = true;
  isError = false;
  currentBrand: any = null;

  constructor(
    private publicService: PublicService,
    private brandService: BrandService,
    private metaService: MetaService
  ) {}

  ngOnInit() {
    this.loadBrandAndEvents();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadBrandAndEvents() {
    this.isLoading = true;
    this.isError = false;

    const domain = window.location.hostname;

    // Load brand info and events in parallel
    this.brandService.loadBrandByDomain(domain)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (brandInfo) => {
          this.currentBrand = brandInfo;
          this.loadEvents(domain);
        },
        error: (error) => {
          console.error('Error loading brand:', error);
          this.isError = true;
          this.isLoading = false;
        }
      });
  }

  private loadEvents(domain: string) {
    this.publicService.getAllEventsForDomain(domain)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (eventsList) => {
          this.eventsList = eventsList;
          this.isLoading = false;
          // Update SEO metadata after events are loaded
          this.updatePageMetadata();
        },
        error: (error) => {
          console.error('Error loading events:', error);
          this.isError = true;
          this.isLoading = false;
        }
      });
  }

  private updatePageMetadata() {
    if (this.currentBrand && this.eventsList) {
      // Find the latest event with a poster for og:image
      let latestEventPoster: string | undefined;
      for (const brand of this.eventsList.brands) {
        for (const event of brand.events) {
          if (event.poster_url && !event.is_closed) {
            latestEventPoster = this.getPosterUrl(event.poster_url);
            break;
          }
        }
        if (latestEventPoster) break;
      }

      const title = `Live Music Directory by ${this.currentBrand.name}`;
      const description = `Check out upcoming events from ${this.currentBrand.brand_name} and affiliated labels. Get your tickets now!`;
      
      this.metaService.updatePageMetadata({
        title,
        description,
        image: latestEventPoster,
        type: 'website',
        siteName: this.currentBrand.brand_name,
        twitterCard: 'summary_large_image'
      });
    }
  }

  formatEventDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  formatPrice(price: number): string {
    return `₱${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }

  getPosterUrl(posterUrl?: string): string {
    if (!posterUrl) {
      return '/assets/img/event-placeholder.jpg';
    }
    return posterUrl.startsWith('http') ? posterUrl : `/api/uploads/events/${posterUrl}`;
  }

  getBuyUrl(event: any): string {
    // Use the buy_shortlink if available, otherwise construct the URL
    if (event.buy_shortlink) {
      return event.buy_shortlink;
    }
    return `/ticket-buy/${event.id}`;
  }

  getBrandColor(brand: any): string {
    return brand.color || '#667eea';
  }

  getAllEventsSorted(): any[] {
    if (!this.eventsList) {
      return [];
    }

    // Flatten all events from all brands and add brand info to each event
    const allEvents: any[] = [];
    this.eventsList.brands.forEach(brand => {
      brand.events.forEach(event => {
        allEvents.push({
          ...event,
          brandName: brand.name,
          brandColor: brand.color || '#667eea'
        });
      });
    });

    // Sort by date (soonest first)
    return allEvents.sort((a, b) => {
      return new Date(a.date_and_time).getTime() - new Date(b.date_and_time).getTime();
    });
  }
}