import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Document } from '../../financial.component';
import { DocumentViewerComponent } from '../../../../components/shared/document-viewer/document-viewer.component';
import { PaginatedTableComponent, TableAction, TableColumn } from '../../../../components/shared/paginated-table/paginated-table.component';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

@Component({
    selector: 'app-financial-documents-tab',
    imports: [CommonModule, FormsModule, DocumentViewerComponent, PaginatedTableComponent, IconComponent],
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

  get docColumns(): TableColumn[] {
    return [
      {
        key: 'filename',
        label: '',
        hideDataLabel: true,
        renderHtml: true,
        formatter: (doc: Document) => {
          const icon = this.getFileIcon(doc.filename);
          return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
        }
      },
      {
        key: 'title',
        label: 'Document Title',
        cardHeader: true,
        renderHtml: true,
        formatter: (doc: Document) => {
          return `<strong>${doc.title}</strong><br><small class="text-muted">${doc.filename}</small>`;
        }
      },
      {
        key: 'upload_date',
        label: 'Upload Date',
        searchable: false,
        formatter: (doc: Document) => this.formatDate(doc.upload_date)
      }
    ];
  }

  get docActions(): TableAction[] {
    return [
      {
        icon: 'eye',
        label: 'View',
        handler: (doc: Document) => this.openDocument(doc)
      },
      {
        icon: 'trash',
        label: 'Delete',
        type: 'danger',
        handler: (doc: Document) => this.deleteDocument(doc.id)
      }
    ];
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }

  getFileIcon(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'image';
      default:
        return 'file';
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