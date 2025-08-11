import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

@Component({
  selector: 'app-add-sublabel-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-sublabel-modal.component.html',
  styleUrls: ['./add-sublabel-modal.component.scss']
})
export class AddSublabelModalComponent {
  @Input() show: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<{brandName: string, subdomainName: string}>();

  formData = {
    brandName: '',
    subdomainName: ''
  };

  submitting: boolean = false;

  onClose(): void {
    this.resetForm();
    this.close.emit();
  }

  onSubmit(form: NgForm): void {
    if (form.valid && !this.submitting) {
      this.submitting = true;
      const subdomainName = this.formData.subdomainName.trim().toLowerCase();
      this.submit.emit({
        brandName: this.formData.brandName.trim(),
        subdomainName: subdomainName
      });
    }
  }

  resetSubmittingState(): void {
    this.submitting = false;
  }

  resetFormAfterSuccess(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.formData = {
      brandName: '',
      subdomainName: ''
    };
    this.submitting = false;
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  // Subdomain validation
  isValidSubdomain(subdomain: string): boolean {
    const subdomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    return subdomainRegex.test(subdomain);
  }
}