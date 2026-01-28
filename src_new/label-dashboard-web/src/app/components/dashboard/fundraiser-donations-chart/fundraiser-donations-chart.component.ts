import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

export interface FundraiserDonations {
  id: number;
  name: string;
  status: string;
  total_raised: number;
  donor_count: number;
}

Chart.register(...registerables);

@Component({
  selector: 'app-fundraiser-donations-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fundraiser-donations-chart.component.html',
  styleUrl: './fundraiser-donations-chart.component.scss'
})
export class FundraiserDonationsChartComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input() fundraiserDonations: FundraiserDonations[] = [];
  @ViewChild('donationsChart') donationsChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('progressChart') progressChartRef!: ElementRef<HTMLCanvasElement>;

  private donationsChart: Chart | null = null;
  private progressChart: Chart | null = null;

  formatCurrency(amount: number): string {
    const validAmount = isNaN(amount) || amount == null ? 0 : amount;
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(validAmount);
  }

  ngOnInit(): void {
    // Don't create charts here - wait for view to be initialized
  }

  ngAfterViewInit(): void {
    if (this.fundraiserDonations.length > 0) {
      this.createCharts();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fundraiserDonations']) {
      if (this.donationsChartRef && this.progressChartRef) {
        if (changes['fundraiserDonations'].firstChange) {
          if (this.fundraiserDonations.length > 0) {
            this.createCharts();
          }
        } else {
          this.updateCharts();
        }
      }
    }
  }

  ngOnDestroy(): void {
    if (this.donationsChart) {
      this.donationsChart.destroy();
    }
    if (this.progressChart) {
      this.progressChart.destroy();
    }
  }

  private createCharts(): void {
    if (!this.donationsChartRef || !this.progressChartRef || !this.fundraiserDonations.length) {
      return;
    }
    this.createDonationsChart();
    this.createProgressChart();
  }

  private truncateLabel(label: string, maxLength: number = 20): string {
    if (label.length <= maxLength) return label;
    return label.substring(0, maxLength - 3) + '...';
  }

  private createDonationsChart(): void {
    const ctx = this.donationsChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const fullLabels = this.fundraiserDonations.map(f => f.name || 'Untitled Fundraiser');
    const labels = fullLabels.map(label => this.truncateLabel(label));
    const data = this.fundraiserDonations.map(f => f.total_raised || 0);

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Raised (PHP)',
          data: data,
          backgroundColor: 'rgba(255, 159, 64, 0.6)',
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Fundraiser Donations'
          },
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              title: (context) => {
                const index = context[0].dataIndex;
                return fullLabels[index];
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '₱' + Number(value).toLocaleString();
              }
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 0
            }
          }
        }
      }
    };

    this.donationsChart = new Chart(ctx, config);
  }

  private createProgressChart(): void {
    const ctx = this.progressChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const fullLabels = this.fundraiserDonations.map(f => f.name || 'Untitled Fundraiser');
    const labels = fullLabels.map(label => this.truncateLabel(label));
    const donorData = this.fundraiserDonations.map(f => f.donor_count || 0);

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Donors',
          data: donorData,
          backgroundColor: 'rgba(153, 102, 255, 0.6)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Donor Count'
          },
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              title: (context) => {
                const index = context[0].dataIndex;
                return fullLabels[index];
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 0
            }
          },
          y: {
            beginAtZero: true
          }
        }
      }
    };

    this.progressChart = new Chart(ctx, config);
  }

  private updateCharts(): void {
    if (this.donationsChart) {
      this.donationsChart.destroy();
    }
    if (this.progressChart) {
      this.progressChart.destroy();
    }
    this.createCharts();
  }
}
