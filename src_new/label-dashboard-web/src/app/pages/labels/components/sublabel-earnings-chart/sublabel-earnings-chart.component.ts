import {
  Component, Input, OnChanges, SimpleChanges,
  AfterViewInit, OnDestroy, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ChildBrand } from '../../../../services/admin.service';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

Chart.register(...registerables);

@Component({
  selector: 'app-sublabel-earnings-chart',
  imports: [CommonModule, IconComponent],
  templateUrl: './sublabel-earnings-chart.component.html',
  styleUrl: './sublabel-earnings-chart.component.scss'
})
export class SublabelEarningsChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() childBrands: ChildBrand[] = [];
  @ViewChild('pieChart') pieChartRef!: ElementRef<HTMLCanvasElement>;

  mode: 'earnings' | 'fees' = 'earnings';
  private chart: Chart | null = null;

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

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['childBrands'] && !changes['childBrands'].firstChange) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    if (!this.pieChartRef) return;

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
