import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EventSales } from '../dashboard/components/event-sales-chart/event-sales-chart.component';
import { FundraiserDonations } from '../dashboard/components/fundraiser-donations-chart/fundraiser-donations-chart.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { AnalyticsPanelComponent } from './components/analytics-panel/analytics-panel.component';
import { BrandService, BrandSettings } from '../../services/brand.service';
import { EventService, Event as AppEvent } from '../../services/event.service';
import { FundraiserService } from '../../services/fundraiser.service';
import { environment } from 'environments/environment';
import { IconComponent } from '../../components/shared/icon/icon.component';

interface CampaignsDashboardStats {
  activeEvents: number;
  activeFundraisers: number;
  activeEventsSales: number;
  activeFundraisersDonations: number;
  activePressCampaigns: number;
  draftPressCampaigns: number;
  syncPitches: number;
}

export interface RecentPressCampaign {
  id: number;
  title: string;
  campaign_type: 'release' | 'event';
  status: 'Draft' | 'Published' | 'Sent';
  public_slug: string;
  release_cover_art: string | null;
  event_poster_url: string | null;
  release_title: string | null;
  event_title: string | null;
}

export interface RecentSyncPitch {
  id: number;
  title: string;
  song_count: number;
  warning_count: number;
}

export interface OngoingFundraiser {
  id: number;
  title: string;
  poster_url: string | null;
  total_raised: number;
}

export interface UpcomingEvent {
  id: number;
  title: string;
  date_and_time: string;
  venue: string;
  poster_url: string | null;
  tickets_sold: number;
  net_earnings: number;
}

interface CampaignsDashboardData {
  user: {
    firstName: string;
    isAdmin: boolean;
  };
  stats: CampaignsDashboardStats;
  ongoingFundraisers: { items: OngoingFundraiser[]; total: number };
  upcomingEvents: UpcomingEvent[];
  recentPressCampaigns: RecentPressCampaign[];
  recentSyncPitches: RecentSyncPitch[];
  eventSales: EventSales[];
  fundraiserDonations: FundraiserDonations[];
}

@Component({
    selector: 'app-events-dashboard',
    imports: [
        CommonModule,
        RouterModule,
        AnalyticsPanelComponent,
        BreadcrumbComponent
, IconComponent],
    templateUrl: './events-dashboard.component.html',
    styleUrl: './events-dashboard.component.scss'
})
export class EventsDashboardComponent implements OnInit {
  dashboardData: CampaignsDashboardData | null = null;
  loading = true;
  error: string | null = null;
  today: Date = new Date();

  todayEventFull: AppEvent | null = null;
  todayEventTicketSummary: { total_tickets_sold: number; total_checked_in: number } | null = null;
  todayEventWalkInTotal: number | null = null;
  copiedField: 'link' | 'pin' | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private brandService: BrandService,
    private eventService: EventService,
    private fundraiserService: FundraiserService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    this.http.get<CampaignsDashboardData>(`${environment.apiUrl}/dashboard/events`).subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.loading = false;
        this.loadTodayEventDetails(data.upcomingEvents);
      },
      error: (error) => {
        console.error('Error loading events dashboard data:', error);
        this.error = 'Failed to load events dashboard data';
        this.loading = false;
      }
    });
  }

  get userFirstName(): string {
    return this.dashboardData?.user?.firstName || 'User';
  }

  getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  navigateToFundraiser(fundraiser: OngoingFundraiser): void {
    this.fundraiserService.setSelectedFundraiser(fundraiser as any);
    this.router.navigate(['/campaigns/fundraisers/details']);
  }

  navigateToPressCampaigns(id?: number): void {
    this.router.navigate(['/campaigns/press'], id ? { queryParams: { open: id } } : {});
  }

  navigateToSyncLicensing(id?: number): void {
    this.router.navigate(['/campaigns/sync-licensing'], id ? { queryParams: { open: id } } : {});
  }

  navigateToEvent(event: UpcomingEvent, route: 'details' | 'tickets', subTab?: string): void {
    this.eventService.setSelectedEvent(event as any);
    this.router.navigate([`/campaigns/events/${route}`], subTab ? { queryParams: { subTab } } : {});
  }

  formatEventDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatEventTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  private loadTodayEventDetails(upcomingEvents: UpcomingEvent[]): void {
    this.todayEventFull = null;
    this.todayEventTicketSummary = null;
    this.todayEventWalkInTotal = null;

    const first = upcomingEvents?.[0];
    if (!first || this.getDaysAway(first.date_and_time) !== 0) return;

    this.eventService.getEvent(first.id).pipe(catchError(() => of(null))).subscribe(event => {
      if (!event) return;
      this.todayEventFull = event;

      const summary$ = this.eventService.getEventTicketSummary(first.id).pipe(catchError(() => of(null)));
      const walkIn$ = event.walk_in_enabled
        ? this.eventService.getWalkInTypes(first.id).pipe(catchError(() => of(null)))
        : of(null);

      forkJoin([summary$, walkIn$]).subscribe(([summary, walkInData]) => {
        if (summary) this.todayEventTicketSummary = summary;
        if (walkInData) {
          this.todayEventWalkInTotal = (walkInData.walkInTypes as any[])
            .reduce((sum: number, t: any) => sum + (t.sold_count || 0), 0);
        }
      });
    });
  }

  copyToClipboard(text: string, field: 'link' | 'pin'): void {
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField = field;
      setTimeout(() => { this.copiedField = null; }, 2000);
    });
  }

  openScannerLink(): void {
    if (this.todayEventFull?.verification_link) {
      window.open(this.todayEventFull.verification_link, '_blank');
    }
  }

  getDaysAway(dateStr: string): number {
    const eventDate = new Date(dateStr);
    const today = new Date();
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.max(0, Math.round((eventDay.getTime() - todayDay.getTime()) / (1000 * 60 * 60 * 24)));
  }

  getDaysAwayLabel(dateStr: string): string {
    const days = this.getDaysAway(dateStr);
    if (days === 0) return 'today';
    if (days === 1) return '1 day away';
    return `${days} days away`;
  }
}
