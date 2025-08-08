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
  @Output() submit = new EventEmitter<{brandName: string, domainName: string}>();

  formData = {
    brandName: '',
    domainName: ''
  };

  submitting: boolean = false;

  onClose(): void {
    this.resetForm();
    this.close.emit();
  }

  onSubmit(form: NgForm): void {
    if (form.valid && !this.submitting) {
      this.submitting = true;
      this.submit.emit({
        brandName: this.formData.brandName.trim(),
        domainName: this.formData.domainName.trim().toLowerCase()
      });
    }
  }

  resetSubmittingState(): void {
    this.submitting = false;
  }

  private resetForm(): void {
    this.formData = {
      brandName: '',
      domainName: ''
    };
    this.submitting = false;
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  // Domain validation
  isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain);
  }
}