import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Document } from '../../../pages/financial/financial.component';

@Component({
  selector: 'app-financial-documents-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }

  getFileIcon(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'fa-file-pdf text-danger';
      case 'doc':
      case 'docx':
        return 'fa-file-word text-primary';
      case 'xls':
      case 'xlsx':
        return 'fa-file-excel text-success';
      case 'txt':
        return 'fa-file-text text-muted';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'fa-file-image text-info';
      default:
        return 'fa-file text-muted';
    }
  }

  openDocument(url: string): void {
    window.open(url, '_blank');
  }

  async deleteDocument(documentId: number): Promise<void> {
    await this.onDeleteDocument(documentId);
  }
}