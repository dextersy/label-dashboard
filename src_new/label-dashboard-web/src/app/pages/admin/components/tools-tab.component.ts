import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, EmailLog, EmailDetail } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { PaginatedTableComponent, PaginationInfo, TableColumn, SearchFilters, SortInfo } from '../../../components/shared/paginated-table/paginated-table.component';

@Component({
    selector: 'app-tools-tab',
    imports: [CommonModule, PaginatedTableComponent],
    templateUrl: './tools-tab.component.html'
})
export class ToolsTabComponent implements OnInit, OnDestroy {
  emailLogs: EmailLog[] = [];
  emailLogsPagination: PaginationInfo | null = null;
  emailLogsLoading: boolean = false;
  emailLogsFilters: any = {};
  emailLogsSort: SortInfo | null = null;
  selectedEmail: EmailDetail | null = null;
  showEmailModal: boolean = false;

  emailLogsColumns: TableColumn[] = [
    { key: 'timestamp', label: 'Timestamp', type: 'date', searchable: true, sortable: true },
    { key: 'recipients', label: 'Recipients', type: 'text', searchable: true, sortable: true },
    { key: 'subject', label: 'Subject', type: 'text', searchable: true, sortable: true },
    { key: 'result', label: 'Result', type: 'text', searchable: true, sortable: true, renderHtml: true, formatter: (item) => {
      const result = item.result;
      if (result === 'Success' || result === 'Successful') {
        return `<span class="badge bg-success">${result}</span>`;
      } else if (result === 'Failed') {
        return `<span class="badge bg-danger">${result}</span>`;
      }
      return result;
    }}
  ];

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadEmailLogs(1, this.emailLogsFilters, this.emailLogsSort);
  }

  ngOnDestroy(): void {
    // Ensure modal-open class is removed if component is destroyed while modal is open
    if (this.showEmailModal) {
      document.body.classList.remove('modal-open');
    }
  }

  loadEmailLogs(page: number, filters: any = {}, sort: SortInfo | null = null): void {
    this.emailLogsLoading = true;
    
    this.adminService.getEmailLogs(page, 50, filters, sort?.column, sort?.direction).subscribe({
      next: (response) => {
        this.emailLogs = response.data;
        this.emailLogsPagination = response.pagination;
        this.emailLogsLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading email logs');
        this.emailLogsLoading = false;
      }
    });
  }

  viewEmailContent(emailId: number): void {
    this.adminService.getEmailDetail(emailId).subscribe({
      next: (email) => {
        this.selectedEmail = email;
        this.showEmailModal = true;
        // Prevent scrolling when modal opens
        document.body.classList.add('modal-open');
      },
      error: (error) => {
        this.notificationService.showError('Error loading email content');
      }
    });
  }

  previewEmail(emailId: number): void {
    this.adminService.getEmailDetail(emailId).subscribe({
      next: (email) => {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
              <meta charset="utf-8">
              <title>Email Preview - ${email.subject}</title>
              <style>
                  body { 
                      margin: 10px; 
                      font-family: Arial, sans-serif; 
                      background-color: #f8f9fa;
                  }
                  .email-content {
                      background-color: white;
                      padding: 20px;
                      border-radius: 8px;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  }
                  .email-header {
                      background-color: #e9ecef;
                      padding: 15px;
                      border-radius: 8px 8px 0 0;
                      margin: -20px -20px 20px -20px;
                      border-bottom: 1px solid #dee2e6;
                  }
                  .email-header h3 {
                      margin: 0 0 10px 0;
                      color: #495057;
                  }
                  .email-meta {
                      font-size: 14px;
                      color: #6c757d;
                  }
              </style>
          </head>
          <body>
              <div class="email-content">
                  <div class="email-header">
                      <h3>${email.subject}</h3>
                      <div class="email-meta">
                          <strong>To:</strong> ${email.recipients}<br>
                          <strong>Date:</strong> ${this.formatDate(email.timestamp)}
                      </div>
                  </div>
                  ${email.body}
              </div>
          </body>
          </html>
        `;
        
        const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
        if (newWindow) {
          newWindow.document.write(htmlContent);
          newWindow.document.close();
        }
      },
      error: (error) => {
        this.notificationService.showError('Error loading email preview');
      }
    });
  }

  closeEmailModal(): void {
    this.showEmailModal = false;
    this.selectedEmail = null;
    // Restore scrolling when modal closes
    document.body.classList.remove('modal-open');
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US') + ' ' + date.toLocaleTimeString('en-US');
  }

  // Email logs table pagination handlers
  onEmailLogsPageChange(page: number): void {
    this.loadEmailLogs(page, this.emailLogsFilters, this.emailLogsSort);
  }

  onEmailLogsFiltersChange(filters: SearchFilters): void {
    this.emailLogsFilters = filters;
    this.loadEmailLogs(1, this.emailLogsFilters, this.emailLogsSort);
  }

  onEmailLogsSortChange(sort: SortInfo | null): void {
    this.emailLogsSort = sort;
    this.loadEmailLogs(this.emailLogsPagination?.current_page || 1, this.emailLogsFilters, this.emailLogsSort);
  }
}