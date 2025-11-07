import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Document } from '../../../pages/financial/financial.component';
import { DocumentViewerComponent } from '../../shared/document-viewer/document-viewer.component';

@Component({
  selector: 'app-financial-documents-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, DocumentViewerComponent],
  templateUrl: './financial-documents-tab.component.html',
  styleUrl: './financial-documents-tab.component.scss'
})
export class FinancialDocumentsTabComponent {
  @Input() documents: Document[] = [];
  @Input() documentUploadForm: any = {};
  @Input() uploadingDocument: boolean = false;
  @Input() onUploadDocument: () => Promise<void> = async () => {};
  @Input() onDeleteDocument: (documentId: number) => Promise<void> = async () => {};
  @Input() onFileSelected: (event: any) => void = () => {};

  // Document viewer state
  selectedDocument: Document | null = null;
  showDocumentViewer: boolean = false;

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }

  getFileIcon(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'fa-solid fa-file-pdf text-danger';
      case 'doc':
      case 'docx':
        return 'fa-solid fa-file-word text-primary';
      case 'xls':
      case 'xlsx':
        return 'fa-solid fa-file-excel text-success';
      case 'txt':
        return 'fa-solid fa-file-lines text-muted';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'fa-solid fa-file-image text-info';
      default:
        return 'fa-file text-muted';
    }
  }

  openDocument(document: Document): void {
    this.selectedDocument = document;
    this.showDocumentViewer = true;
  }

  closeDocumentViewer(): void {
    this.showDocumentViewer = false;
    this.selectedDocument = null;
  }

  async deleteDocument(documentId: number): Promise<void> {
    await this.onDeleteDocument(documentId);
  }
}