import {
  Component, Input, OnInit, AfterViewInit, OnDestroy,
  ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Chart, ChartConfiguration,
  ArcElement, DoughnutController, Tooltip, Legend
} from 'chart.js';
import { AdminService, ChildBrand } from '../../../../services/admin.service';
import { Router } from '@angular/router';
import { DateRangeFilterComponent, DateRangeSelection } from '../../../../components/shared/date-range-filter/date-range-filter.component';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

Chart.register(ArcElement, DoughnutController, Tooltip, Legend);

@Component({
  selector: 'app-sublabel-earnings-chart',
  imports: [CommonModule, DateRangeFilterComponent, IconComponent],
  templateUrl: './sublabel-earnings-chart.component.html',
  styleUrl: './sublabel-earnings-chart.component.scss'
})
export class SublabelEarningsChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() ctaLabel: string = 'View Sublabels →';
  @Input() ctaRoute: string = '/labels/sublabels';
  @ViewChild('pieChart') pieChartRef!: ElementRef<HTMLCanvasElement>;

  mode: 'earnings' | 'fees' = 'earnings';
  loading = false;
  private childBrands: ChildBrand[] = [];
  private chart: Chart | null = null;
  private startDate = '';
  private endDate = '';
  private viewReady = false;

  constructor(private adminService: AdminService, private router: Router) {}

  goToCta(): void {
    this.router.navigate([this.ctaRoute]);
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  get musicValue(): number {
    return this.mode === 'earnings'
      ? this.childBrands.reduce((s, b) => s + (b.music_earnings || 0) + (b.total_royalties || 0), 0)
      : this.childBrands.reduce((s, b) => s + (b.music_platform_fees || 0), 0);
  }

  get eventValue(): number {
    return this.mode === 'earnings'
      ? this.childBrands.reduce((s, b) => s + (b.event_earnings || 0), 0)
      : this.childBrands.reduce((s, b) => s + (b.event_platform_fees || 0), 0);
  }

  get fundraiserValue(): number {
    return this.mode === 'earnings'
      ? this.childBrands.reduce((s, b) => s + (b.fundraiser_earnings || 0), 0)
      : this.childBrands.reduce((s, b) => s + (b.fundraiser_platform_fees || 0), 0);
  }

  get total(): number {
    return this.musicValue + this.eventValue + this.fundraiserValue;
  }

  get isEmpty(): boolean {
    return this.total === 0;
  }

  pct(value: number): number {
    return this.total > 0 ? Math.round((value / this.total) * 100) : 0;
  }

  formatCurrency(amount: number): string {
    return '₱' + (amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  setMode(mode: 'earnings' | 'fees'): void {
    this.mode = mode;
    this.renderChart();
  }

  onDateRangeChange(range: DateRangeSelection): void {
    if (range.preset === 'alltime') {
      this.startDate = '';
      this.endDate = '';
    } else {
      this.startDate = range.startDate;
      this.endDate = range.endDate;
    }
    this.loadData();
  }

  private loadData(): void {
    this.loading = true;
    this.adminService.getSublabels(this.startDate || undefined, this.endDate || undefined).subscribe({
      next: (brands) => {
        this.childBrands = brands;
        this.loading = false;
        this.renderChart();
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private renderChart(): void {
    if (!this.viewReady || !this.pieChartRef) return;

    this.chart?.destroy();
    this.chart = null;

    if (this.isEmpty) return;

    const ctx = this.pieChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: ['Music', 'Events', 'Fundraisers'],
        datasets: [{
          data: [this.musicValue, this.eventValue, this.fundraiserValue],
          backgroundColor: ['#0891b2', '#f59e0b', '#ef4444'],
          borderColor: '#fff',
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.raw as number;
                return ` ₱${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              }
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }
}
