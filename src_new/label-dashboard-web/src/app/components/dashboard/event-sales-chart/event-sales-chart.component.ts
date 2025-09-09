import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

export interface EventSales {
  id: number;
  name: string;
  location: string;
  date: string;
  total_sales: number;
  tickets_sold: number;
  total_tickets: number;
  total_checked_in: number;
}

Chart.register(...registerables);

@Component({
  selector: 'app-event-sales-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event-sales-chart.component.html',
  styleUrl: './event-sales-chart.component.scss'
})
export class EventSalesChartComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input() eventSales: EventSales[] = [];
  @ViewChild('salesChart') salesChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('ticketsChart') ticketsChartRef!: ElementRef<HTMLCanvasElement>;
  
  private salesChart: Chart | null = null;
  private ticketsChart: Chart | null = null;

  formatCurrency(amount: number): string {
    // Handle null, undefined, or NaN values
    const validAmount = isNaN(amount) || amount == null ? 0 : amount;
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(validAmount);
  }

  formatDate(dateString: string): string {
    if (!dateString) {
      return 'TBA';
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getProgressPercentage(sold: number, total: number): number {
    // Handle null, undefined, or NaN values
    const validSold = isNaN(sold) || sold == null ? 0 : sold;
    const validTotal = isNaN(total) || total == null ? 0 : total;
    return validTotal > 0 ? Math.round((validSold / validTotal) * 100) : 0;
  }

  ngOnInit(): void {
    // Don't create charts here - wait for view to be initialized
  }

  ngAfterViewInit(): void {
    // Create charts after view is initialized
    if (this.eventSales.length > 0) {
      this.createCharts();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['eventSales']) {
      // Only proceed if view has been initialized
      if (this.salesChartRef && this.ticketsChartRef) {
        if (changes['eventSales'].firstChange) {
          // First time data is set, create charts
          if (this.eventSales.length > 0) {
            this.createCharts();
          }
        } else {
          // Data changed, update existing charts
          this.updateCharts();
        }
      }
    }
  }

  ngOnDestroy(): void {
    if (this.salesChart) {
      this.salesChart.destroy();
    }
    if (this.ticketsChart) {
      this.ticketsChart.destroy();
    }
  }

  private createCharts(): void {
    if (!this.salesChartRef || !this.ticketsChartRef || !this.eventSales.length) {
      return;
    }
    this.createSalesChart();
    this.createTicketsChart();
  }

  private createSalesChart(): void {
    const ctx = this.salesChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.eventSales.map(event => event.name || 'Untitled Event');
    const data = this.eventSales.map(event => event.total_sales || 0);

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Sales (PHP)',
          data: data,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Event Sales'
          },
          legend: {
            display: false
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

    this.salesChart = new Chart(ctx, config);
  }

  private createTicketsChart(): void {
    const ctx = this.ticketsChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.eventSales.map(event => event.name || 'Untitled Event');
    const soldData = this.eventSales.map(event => event.tickets_sold || 0);
    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Tickets Sold',
          data: soldData,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Tickets Sold'
          },
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              maxRotation: 45,
              minRotation: 0
            }
          },
          y: {
            stacked: true,
            beginAtZero: true
          }
        }
      }
    };

    this.ticketsChart = new Chart(ctx, config);
  }

  private updateCharts(): void {
    if (this.salesChart) {
      this.salesChart.destroy();
    }
    if (this.ticketsChart) {
      this.ticketsChart.destroy();
    }
    this.createCharts();
  }
}