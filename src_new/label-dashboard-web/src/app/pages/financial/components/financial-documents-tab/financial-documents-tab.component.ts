import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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
  constructor(private sanitizer: DomSanitizer) {}
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
          const info = this.getFileTypeInfo(doc.filename);
          return this.sanitizer.bypassSecurityTrustHtml(`<span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:0.04em;background:${info.bgColor};color:#fff;white-space:nowrap">${info.label}</span>`);
        }
      },
      {
        key: 'title',
        label: 'Document Title',
        cardHeader: true,
        renderHtml: true,
        maxWidth: '400px',
        formatter: (doc: Document) => {
          return `<div style="min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${doc.title}</div><small style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#6b7280">${doc.filename}</small></div>`;
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

  getFileTypeInfo(filename: string): { label: string; bgColor: string } {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    switch (ext) {
      case 'pdf':   return { label: 'PDF',  bgColor: '#dc2626' };
      case 'doc':
      case 'docx':  return { label: 'DOC',  bgColor: '#2563eb' };
      case 'xls':
      case 'xlsx':  return { label: 'XLS',  bgColor: '#16a34a' };
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':   return { label: 'IMG',  bgColor: '#9333ea' };
      case 'txt':   return { label: 'TXT',  bgColor: '#6b7280' };
      default:      return { label: ext.toUpperCase() || 'FILE', bgColor: '#6b7280' };
    }
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