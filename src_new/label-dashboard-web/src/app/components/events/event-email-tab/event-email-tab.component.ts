import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { EventService, Event } from '../../../services/event.service';
import { QuillModule } from 'ngx-quill';
import { TestEmailModalComponent, TestEmailData } from '../test-email-modal/test-email-modal.component';
import 'quill/dist/quill.snow.css';

@Component({
    selector: 'app-event-email-tab',
    imports: [CommonModule, FormsModule, QuillModule, TestEmailModalComponent],
    templateUrl: './event-email-tab.component.html',
    styleUrl: './event-email-tab.component.scss'
})
export class EventEmailTabComponent implements OnInit, OnDestroy, OnChanges {
  @Input() selectedEvent: Event | null = null;
  @Input() isAdmin: boolean = false;
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();
  
  @ViewChild('testEmailModal') testEmailModal!: TestEmailModalComponent;

  subject: string = '';
  message: string = '';
  includeBanner: boolean = true;
  recipientsCount: number = 0;
  loading: boolean = false;
  loadingCount: boolean = false;
  sending: boolean = false;

  private subscription = new Subscription();

  // Rich text editor configuration for better formatting options
  quillConfig = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'header': 1 }, { 'header': 2 }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'font': [] }],
      [{ 'align': [] }],
      ['clean'],
      ['link', 'image']
    ],
    theme: 'snow'
  };

  constructor(private eventService: EventService) {}

  ngOnInit(): void {
    if (this.selectedEvent) {
      this.loadTicketHoldersCount();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedEvent']) {
      if (this.selectedEvent) {
        this.loadTicketHoldersCount();
        // Reset form when event changes
        this.resetForm();
      } else {
        // Clear recipients count when no event is selected
        this.recipientsCount = 0;
        this.resetForm();
      }
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadTicketHoldersCount(): void {
    if (!this.selectedEvent) return;

    this.loadingCount = true;
    this.subscription.add(
      this.eventService.getEventTicketHoldersCount(this.selectedEvent.id).subscribe({
        next: (response) => {
          this.recipientsCount = response.recipients_count;
          this.loadingCount = false;
        },
        error: (error) => {
          console.error('Error loading ticket holders count:', error);
          this.alertMessage.emit({ type: 'error', text: error.message || 'Failed to load ticket holders count' });
          this.loadingCount = false;
        }
      })
    );
  }

  sendEmail(): void {
    if (!this.selectedEvent || !this.subject.trim() || !this.message.trim()) {
      this.alertMessage.emit({ type: 'error', text: 'Please fill in both subject and message' });
      return;
    }

    if (this.recipientsCount === 0) {
      this.alertMessage.emit({ type: 'error', text: 'No confirmed ticket holders found for this event' });
      return;
    }

    // Validate content size limits
    if (this.subject.trim().length > 500) {
      this.alertMessage.emit({ type: 'error', text: 'Subject line is too long (maximum 500 characters)' });
      return;
    }

    // Check message size (10MB limit)
    const messageSizeInBytes = new Blob([this.message]).size;
    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
    if (messageSizeInBytes > maxSizeInBytes) {
      const sizeMB = (messageSizeInBytes / 1024 / 1024).toFixed(2);
      this.alertMessage.emit({ 
        type: 'error', 
        text: `Message content is too large: ${sizeMB}MB (maximum 10MB). Please reduce image sizes or remove some images.` 
      });
      return;
    }

    // Check if message contains images
    const hasImages = this.message.includes('<img') && this.message.includes('data:image');
    if (hasImages) {
      this.alertMessage.emit({ 
        type: 'info', 
        text: 'Processing images in your message. This may take a moment...' 
      });
    }

    this.sending = true;
    this.subscription.add(
      this.eventService.sendEventEmail(this.selectedEvent.id, {
        subject: this.subject.trim(),
        message: this.message,
        include_banner: this.includeBanner
      }).subscribe({
        next: (response) => {
          const successMessage = `Email sent successfully! ${response.success_count} recipients received the email.`;
          this.alertMessage.emit({ type: 'success', text: successMessage });
          
          if (response.failed_count > 0) {
            this.alertMessage.emit({ 
              type: 'info', 
              text: `Note: ${response.failed_count} emails failed to send.` 
            });
          }

          // Handle image processing results
          if (response.image_stats) {
            const { processed, skipped, reasons } = response.image_stats;
            
            if (processed > 0) {
              this.alertMessage.emit({ 
                type: 'success', 
                text: `${processed} image${processed !== 1 ? 's' : ''} processed and included in email.` 
              });
            }
            
            if (skipped > 0) {
              const uniqueReasons = [...new Set(reasons)];
              this.alertMessage.emit({ 
                type: 'warning', 
                text: `${skipped} image${skipped !== 1 ? 's' : ''} skipped: ${uniqueReasons.join(', ')}` 
              });
            }
          }
          
          // Reset form
          this.resetForm();
        },
        error: (error) => {
          console.error('Error sending email:', error);
          this.alertMessage.emit({ type: 'error', text: error.message || 'Failed to send email' });
          this.sending = false;
        }
      })
    );
  }

  resetForm(): void {
    this.subject = '';
    this.message = '';
    this.includeBanner = true;
    this.sending = false;
    this.loading = false;
  }

  getContentSizeText(): string {
    const sizeInBytes = new Blob([this.message || '']).size;
    const sizeInMB = sizeInBytes / (1024 * 1024);
    
    if (sizeInMB >= 1) {
      return `${sizeInMB.toFixed(2)} MB / 10 MB`;
    } else {
      return `${(sizeInBytes / 1024).toFixed(0)} KB / 10 MB`;
    }
  }

  getContentSizeClass(): string {
    const sizeInBytes = new Blob([this.message || '']).size;
    const maxSize = 10 * 1024 * 1024; // 10MB
    const warningSize = 8 * 1024 * 1024; // 8MB
    
    if (sizeInBytes > maxSize) {
      return 'text-danger fw-bold';
    } else if (sizeInBytes > warningSize) {
      return 'text-warning fw-bold';
    } else {
      return 'text-muted';
    }
  }

  isContentTooLarge(): boolean {
    const sizeInBytes = new Blob([this.message || '']).size;
    return sizeInBytes > (10 * 1024 * 1024); // 10MB
  }

  isFormValid(): boolean {
    return !!(
      this.subject && 
      this.subject.trim().length > 0 && 
      this.subject.trim().length <= 500 &&
      this.message && 
      this.message.trim().length > 0 && 
      !this.isContentTooLarge()
    );
  }

  showTestEmailModal(): void {
    if (!this.selectedEvent || !this.isFormValid()) {
      this.alertMessage.emit({ type: 'error', text: 'Please complete the email form before sending a test' });
      return;
    }

    this.testEmailModal.showModal(this.subject, this.message);
  }

  onTestEmailConfirmed(testData: TestEmailData): void {
    if (!this.selectedEvent) {
      this.alertMessage.emit({ type: 'error', text: 'No event selected' });
      this.testEmailModal.setLoading(false);
      return;
    }

    this.subscription.add(
      this.eventService.sendTestEventEmail(this.selectedEvent.id, {
        subject: testData.subject,
        message: testData.message,
        emails: testData.emails,
        include_banner: this.includeBanner
      }).subscribe({
        next: (response) => {
          const successMessage = `Test email sent successfully! ${response.success_count} recipients received the test email.`;
          this.alertMessage.emit({ type: 'success', text: successMessage });
          
          if (response.failed_count > 0) {
            this.alertMessage.emit({ 
              type: 'warning', 
              text: `Note: ${response.failed_count} test emails failed to send.` 
            });
          }

          // Handle image processing results
          if (response.image_stats) {
            const { processed, skipped, reasons } = response.image_stats;
            
            if (processed > 0) {
              this.alertMessage.emit({ 
                type: 'success', 
                text: `${processed} image${processed !== 1 ? 's' : ''} processed and included in test email.` 
              });
            }
            
            if (skipped > 0) {
              const uniqueReasons = [...new Set(reasons)];
              this.alertMessage.emit({ 
                type: 'warning', 
                text: `${skipped} image${skipped !== 1 ? 's' : ''} skipped in test email: ${uniqueReasons.join(', ')}` 
              });
            }
          }
          
          this.testEmailModal.setLoading(false);
          this.testEmailModal.hide();
        },
        error: (error) => {
          console.error('Error sending test email:', error);
          this.alertMessage.emit({ type: 'error', text: error.message || 'Failed to send test email' });
          this.testEmailModal.setLoading(false);
        }
      })
    );
  }
}