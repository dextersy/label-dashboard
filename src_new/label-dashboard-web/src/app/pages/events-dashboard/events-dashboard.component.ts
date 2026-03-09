import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { EventSalesChartComponent, EventSales } from '../dashboard/components/event-sales-chart/event-sales-chart.component';
import { FundraiserDonationsChartComponent, FundraiserDonations } from '../dashboard/components/fundraiser-donations-chart/fundraiser-donations-chart.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { BrandService, BrandSettings } from '../../services/brand.service';
import { EventService } from '../../services/event.service';
import { FundraiserService } from '../../services/fundraiser.service';
import { environment } from 'environments/environment';

interface CampaignsDashboardStats {
  activeEvents: number;
  activeFundraisers: number;
  thisMonthSales: number;
  thisMonthDonations: number;
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
}

interface CampaignsDashboardData {
  user: {
    firstName: string;
    isAdmin: boolean;
  };
  stats: CampaignsDashboardStats;
  ongoingFundraisers: { items: OngoingFundraiser[]; total: number };
  upcomingEvents: UpcomingEvent[];
  eventSales: EventSales[];
  fundraiserDonations: FundraiserDonations[];
}

@Component({
    selector: 'app-events-dashboard',
    imports: [
        CommonModule,
        RouterModule,
        EventSalesChartComponent,
        FundraiserDonationsChartComponent,
        BreadcrumbComponent
    ],
    templateUrl: './events-dashboard.component.html',
    styleUrl: './events-dashboard.component.scss'
})
export class EventsDashboardComponent implements OnInit {
  dashboardData: CampaignsDashboardData | null = null;
  loading = true;
  error: string | null = null;
  today: Date = new Date();

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

  navigateToEvent(event: UpcomingEvent, route: 'details' | 'tickets'): void {
    this.eventService.setSelectedEvent(event as any);
    this.router.navigate([`/campaigns/events/${route}`]);
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
}
