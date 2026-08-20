import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { IconComponent } from '../icon/icon.component';
import { PlanLimitService, StorageInfo } from '../../../services/plan-limit.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './file-upload.component.html',
})
export class FileUploadComponent implements OnInit, OnDestroy {
  /** File types to accept, e.g. "image/*" or ".mp3,.wav" */
  @Input() accept = '*/*';

  /** Label shown on the button (single mode) or drop zone (multiple mode) */
  @Input() label = 'Choose file';

  /** Optional hint text shown below the control */
  @Input() hint = '';

  /** Whether this upload counts toward the storage quota. Default true. */
  @Input() enforceStorageLimit = true;

  /** Whether the control is disabled */
  @Input() disabled = false;

  /** Allow selecting multiple files at once — renders a drag-and-drop zone */
  @Input() multiple = false;

  /** Maximum number of files allowed (multiple mode only). 0 = unlimited. */
  @Input() maxFiles = 0;

  /** Name of the currently uploaded file to display (optional, single mode only) */
  @Input() currentFileName: string | null = null;

  /** Emits the selected File (single mode) after passing all size checks */
  @Output() fileSelected = new EventEmitter<File>();

  /** Emits the selected File array (multiple mode) after passing all size checks */
  @Output() filesSelected = new EventEmitter<File[]>();

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  storageInfo: StorageInfo | null = null;
  errorMessage: string | null = null;
  isDragOver = false;
  isAdmin = false;

  private sub = new Subscription();

  constructor(
    private planLimitService: PlanLimitService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    if (this.enforceStorageLimit) {
      this.sub.add(
        this.planLimitService.getStorageInfo().subscribe({
          next: info => { this.storageInfo = info; },
          error: () => { this.storageInfo = null; },
        })
      );
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get remainingBytes(): number | null {
    if (!this.storageInfo || this.storageInfo.limitBytes === null) return null;
    return Math.max(0, this.storageInfo.limitBytes - this.storageInfo.usedBytes);
  }

  get storageBarPercent(): number {
    if (!this.storageInfo || this.storageInfo.limitBytes === null || this.storageInfo.limitBytes === 0) return 0;
    return Math.min(100, Math.round((this.storageInfo.usedBytes / this.storageInfo.limitBytes) * 100));
  }

  get storageBarClass(): string {
    const pct = this.storageBarPercent;
    if (pct >= 95) return 'tw-bg-red-500';
    if (pct >= 80) return 'tw-bg-amber-500';
    return 'tw-bg-[var(--brand-color)]';
  }

  get isBlocked(): boolean {
    return this.disabled || (this.enforceStorageLimit && this.remainingBytes === 0);
  }

  formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  }

  openFilePicker(): void {
    if (!this.isBlocked) {
      this.fileInputRef.nativeElement.click();
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isBlocked) {
      this.isDragOver = true;
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    if (this.isBlocked) return;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    await this.processFiles(files);
  }

  async onFileChange(event: Event): Promise<void> {
    this.errorMessage = null;
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    await this.processFiles(files);
    input.value = '';
  }

  private async processFiles(files: FileList): Promise<void> {
    this.errorMessage = null;

    if (this.multiple && this.maxFiles > 0 && files.length > this.maxFiles) {
      this.errorMessage = `You can upload a maximum of ${this.maxFiles} files at a time.`;
      return;
    }

    if (this.enforceStorageLimit) {
      const totalSize = Array.from(files).reduce((sum, f) => sum + f.size, 0);
      const result = await this.planLimitService.checkStorageLimit(totalSize);
      if (result === 'blocked_admin') {
        this.planLimitService.showUpgradeModal({ limit_type: 'storage' });
        return;
      }
      if (result === 'blocked_nonadmin') {
        this.errorMessage = 'No storage space left. Contact your label representative for support.';
        return;
      }
    }

    if (this.multiple) {
      this.filesSelected.emit(Array.from(files));
    } else {
      this.fileSelected.emit(files[0]);
    }
  }
}
