import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Chart } from 'chart.js/auto';

export interface TopEarningRelease {
  id: number;
  catalog_no: string;
  title: string;
  artist_name: string;
  total_earnings: number;
  cover_art?: string;
}

@Component({
    selector: 'app-top-albums',
    imports: [CommonModule],
    templateUrl: './top-albums.component.html',
    styleUrl: './top-albums.component.scss'
})
export class TopAlbumsComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() releases: TopEarningRelease[] = [];
  @ViewChild('earningsChart') chartCanvas!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private viewInitialized = false;

  constructor(private router: Router) {}

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.buildChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['releases'] && this.viewInitialized) {
      this.buildChart();
    }
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  private buildChart(): void {
    if (!this.chartCanvas) {
      return;
    }

    this.destroyChart();

    const top6 = this.releases.slice(0, 6);

    if (top6.length === 0) {
      return;
    }

    const brandColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--brand-color')
      .trim() || '#3b82f6';

    const labels = top6.map(r => {
      const combined = `${r.title} — ${r.artist_name}`;
      return combined.length > 28 ? combined.slice(0, 28) + '…' : combined;
    });
    const data = top6.map(r => r.total_earnings);
    const fullTitles = top6.map(r => `${r.title} — ${r.artist_name}`);

    const formatCurrencyShort = this.formatCurrencyShort.bind(this);

    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: brandColor,
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 10
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return fullTitles[idx];
              },
              label: (item) => {
                return ' ' + this.formatCurrency(item.raw as number);
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              callback: (value) => {
                return this.formatCurrencyShort(value as number);
              },
              font: { size: 11 },
              color: '#9ca3af'
            },
            grid: {
              color: 'rgba(0,0,0,0.05)'
            }
          },
          y: {
            ticks: {
              font: { size: 11 },
              color: '#4a5568'
            },
            grid: {
              display: false
            }
          }
        }
      },
      plugins: [{
        id: 'barAmountLabels',
        afterDatasetsDraw(chart) {
          const ctx = chart.ctx;
          const dataset = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);

          ctx.save();
          ctx.font = '600 11px "Source Sans 3", sans-serif';
          ctx.fillStyle = '#4a5568';
          ctx.textBaseline = 'middle';

          meta.data.forEach((bar, i) => {
            const value = dataset.data[i] as number;
            const label = formatCurrencyShort(value);
            const x = bar.x + 6;
            const y = bar.y;
            ctx.fillText(label, x, y);
          });

          ctx.restore();
        }
      }]
    });
  }

  goToFinancial(): void {
    this.router.navigate(['/financial/release']);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  private formatCurrencyShort(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0
    }).format(amount);
  }

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }

  getCoverArtUrl(coverArt: string | undefined): string {
    if (!coverArt || !coverArt.startsWith('http')) {
      return 'assets/img/placeholder.jpg';
    }
    return coverArt;
  }
}
