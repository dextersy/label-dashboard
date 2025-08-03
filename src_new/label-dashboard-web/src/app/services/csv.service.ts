import { Injectable } from '@angular/core';

// Extend Navigator interface for IE compatibility
declare global {
  interface Navigator {
    msSaveBlob?: (blob: Blob, defaultName?: string) => boolean;
  }
}

export interface CsvDownloadOptions {
  filename: string;
  headers: string[];
  data: any[][];
  title?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CsvService {

  constructor() { }

  /**
   * Download data as CSV file
   */
  downloadCsv(options: CsvDownloadOptions): void {
    const csvContent = this.generateCsvContent(options);
    this.downloadFile(csvContent, options.filename);
  }

  /**
   * Generate CSV content from data
   */
  private generateCsvContent(options: CsvDownloadOptions): string {
    let csvContent = '';

    // Add title if provided
    if (options.title) {
      csvContent += this.escapeField(options.title) + '\n';
      csvContent += '-----\n';
    }

    // Add headers
    csvContent += options.headers.map(header => this.escapeField(header)).join(',') + '\n';

    // Add data rows
    options.data.forEach(row => {
      csvContent += row.map(field => this.escapeField(field)).join(',') + '\n';
    });

    return csvContent;
  }

  /**
   * Escape and quote CSV fields if necessary
   */
  private escapeField(field: any): string {
    if (field === null || field === undefined) {
      return '';
    }

    const stringField = String(field);
    
    // Check if field contains comma, quotes, or newlines
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
      // Escape quotes by doubling them and wrap in quotes
      return '"' + stringField.replace(/"/g, '""') + '"';
    }

    return stringField;
  }

  /**
   * Download file with given content
   */
  private downloadFile(content: string, filename: string): void {
    // Add BOM for better Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Fallback for older browsers
      if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, filename);
      }
    }
  }

  /**
   * Format date for CSV display
   */
  formatDateForCsv(dateString: string): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Format currency for CSV display
   */
  formatCurrencyForCsv(amount: number, currency: string = 'PHP'): string {
    if (typeof amount !== 'number') return '';
    
    return `${currency} ${amount.toFixed(2)}`;
  }
}