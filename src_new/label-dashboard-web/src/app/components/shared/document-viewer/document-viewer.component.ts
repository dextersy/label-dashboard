import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Document } from '../../../pages/financial/financial.component';

@Component({
    selector: 'app-document-viewer',
    imports: [CommonModule],
    templateUrl: './document-viewer.component.html',
    styleUrl: './document-viewer.component.scss'
})
export class DocumentViewerComponent implements OnInit, OnChanges {
  @Input() document: Document | null = null;
  @Input() isVisible: boolean = false;
  @Output() close = new EventEmitter<void>();

  documentType: 'pdf' | 'image' | 'office' | 'text' | 'unsupported' = 'unsupported';
  loading: boolean = true;
  safeUrl: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit() {
    if (this.document) {
      this.determineDocumentType();
      this.sanitizeUrl();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isVisible']) {
      if (this.isVisible) {
        // Modal opened - prevent scrolling
        document.body.classList.add('modal-open');
      } else {
        // Modal closed - restore scrolling
        document.body.classList.remove('modal-open');
      }
    }
    
    if (changes['document'] && this.document) {
      this.loading = true;
      this.determineDocumentType();
      this.sanitizeUrl();
    }
  }

  private determineDocumentType(): void {
    if (!this.document) return;

    const extension = this.document.filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        this.documentType = 'pdf';
        break;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        this.documentType = 'image';
        break;
      case 'doc':
      case 'docx':
      case 'xls':
      case 'xlsx':
      case 'ppt':
      case 'pptx':
        this.documentType = 'office';
        break;
      case 'txt':
        this.documentType = 'text';
        break;
      default:
        this.documentType = 'unsupported';
    }
  }

  private sanitizeUrl(): void {
    if (!this.document) {
      this.safeUrl = null;
      return;
    }
    
    // Sanitize the URL for use in iframe
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.document.url);
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onImageLoad(): void {
    this.loading = false;
  }

  onImageError(): void {
    this.loading = false;
  }

  onPdfLoad(): void {
    this.loading = false;
  }

  downloadDocument(): void {
    if (this.document) {
      const link = document.createElement('a');
      link.href = this.document.url;
      link.download = this.document.filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  openInNewTab(): void {
    if (this.document) {
      window.open(this.document.url, '_blank');
    }
  }

  getFileIcon(): string {
    const extension = this.document?.filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'fa-solid fa-file-pdf text-danger';
      case 'doc':
      case 'docx':
        return 'fa-solid fa-file-word text-primary';
      case 'xls':
      case 'xlsx':
        return 'fa-solid fa-file-excel text-success';
      case 'ppt':
      case 'pptx':
        return 'fa-solid fa-file-powerpoint text-warning';
      case 'txt':
        return 'fa-solid fa-file-lines text-muted';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return 'fa-solid fa-file-image text-info';
      default:
        return 'fa-solid fa-file text-muted';
    }
  }
}