import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { LatestAlbumsComponent, LatestRelease } from '../../components/dashboard/latest-albums/latest-albums.component';
import { TopAlbumsComponent, TopEarningRelease } from '../../components/dashboard/top-albums/top-albums.component';
import { BalanceTableComponent, ArtistBalance } from '../../components/dashboard/balance-table/balance-table.component';
import { EventSalesChartComponent, EventSales } from '../../components/dashboard/event-sales-chart/event-sales-chart.component';
import { environment } from 'environments/environment';

interface DashboardData {
  user: {
    firstName: string;
    isAdmin: boolean;
  };
  latestReleases: LatestRelease[];
  topEarningReleases: TopEarningRelease[];
  balanceSummary: ArtistBalance[];
  eventSales?: EventSales[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    LatestAlbumsComponent,
    TopAlbumsComponent,
    BalanceTableComponent,
    EventSalesChartComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  dashboardData: DashboardData | null = null;
  loading = true;
  error: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    this.http.get<DashboardData>(`${environment.apiUrl}/dashboard`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.error = 'Failed to load dashboard data';
        this.loading = false;
      }
    });
  }

  get isAdmin(): boolean {
    return this.dashboardData?.user?.isAdmin || false;
  }

  get userFirstName(): string {
    return this.dashboardData?.user?.firstName || 'User';
  }
}
