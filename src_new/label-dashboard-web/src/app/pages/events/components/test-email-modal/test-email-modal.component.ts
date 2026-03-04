import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface TestEmailData {
  emails: string[];
  subject: string;
  message: string;
}

@Component({
    selector: 'app-test-email-modal',
    imports: [CommonModule, FormsModule],
    templateUrl: './test-email-modal.component.html',
    styleUrl: './test-email-modal.component.scss'
})
export class TestEmailModalComponent {
  @Input() show: boolean = false;
  @Input() currentSubject: string = '';
  @Input() currentMessage: string = '';
  @Output() testEmailConfirmed = new EventEmitter<TestEmailData>();

  loading = false;
  emailsText = '';

  showModal(subject?: string, message?: string): void {
    this.loading = false;
    this.show = true;
    this.currentSubject = subject || '';
    this.currentMessage = message || '';
    this.emailsText = '';
  }

  hide(): void {
    this.show = false;
    this.resetForm();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.hide();
    }
  }

  onSendTest(): void {
    // Validate email addresses
    const emails = this.parseEmails(this.emailsText);
    if (emails.length === 0) {
      return;
    }

    if (!this.currentSubject.trim() || !this.currentMessage.trim()) {
      return;
    }

    this.loading = true;
    this.testEmailConfirmed.emit({
      emails,
      subject: this.currentSubject,
      message: this.currentMessage
    });
  }

  setLoading(loading: boolean): void {
    this.loading = loading;
  }

  resetForm(): void {
    this.emailsText = '';
    this.loading = false;
  }

  parseEmails(emailText: string): string[] {
    if (!emailText.trim()) return [];
    
    // Split by common separators and filter out invalid emails
    const emails = emailText
      .split(/[,;\n\r\s]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0 && this.isValidEmail(email));
    
    return [...new Set(emails)]; // Remove duplicates
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  getEmailCount(): number {
    return this.parseEmails(this.emailsText).length;
  }

  getInvalidEmails(): string[] {
    if (!this.emailsText.trim()) return [];
    
    return this.emailsText
      .split(/[,;\n\r\s]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0 && !this.isValidEmail(email));
  }

  isFormValid(): boolean {
    const emails = this.parseEmails(this.emailsText);
    return emails.length > 0 && 
           this.currentSubject.trim().length > 0 && 
           this.currentMessage.trim().length > 0;
  }
}