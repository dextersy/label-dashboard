import { Component, Input, Output, EventEmitter, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReleaseTaskTemplateService } from '../../../../../services/release-task-template.service';
import { NotificationService } from '../../../../../services/notification.service';
import { AuthService } from '../../../../../services/auth.service';
import { ReleaseTaskTemplate } from '../../../../../models/release-task-template.model';
import { ReleaseTask } from '../../../../../models/release-task.model';
import { IconComponent } from '../../../../../components/shared/icon/icon.component';
import { ModalToBodyDirective } from '../../../../../directives/modal-to-body.directive';
import { TemplateEditorModalComponent } from '../template-editor-modal/template-editor-modal.component';

@Component({
  selector: 'app-template-picker-modal',
  standalone: true,
  imports: [CommonModule, IconComponent, ModalToBodyDirective, TemplateEditorModalComponent],
  templateUrl: './template-picker-modal.component.html',
  styleUrls: ['../release-planning-tab.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class TemplatePickerModalComponent implements OnInit {
  @Input() releaseId!: number;
  @Input() isAdmin = false;
  @Output() applied = new EventEmitter<ReleaseTask[]>();
  @Output() closed = new EventEmitter<void>();

  templates: ReleaseTaskTemplate[] = [];
  loading = false;
  applyingId: number | null = null;
  hidingId: number | null = null;
  expandedId: number | null = null;
  editingTemplate: ReleaseTaskTemplate | null | undefined = undefined; // undefined = hidden, null = new

  currentBrandId: number | null = null;
  currentUserId: number | null = null;

  constructor(
    private templateService: ReleaseTaskTemplateService,
    private notificationService: NotificationService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    this.currentBrandId = user?.brand_id ?? null;
    this.currentUserId = user?.id ?? null;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.templateService.listTemplates().subscribe({
      next: (res) => {
        this.templates = res.templates;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notificationService.showError('Failed to load templates');
      },
    });
  }

  get ownTemplates(): ReleaseTaskTemplate[] {
    return this.templates.filter(t => t.brand_id === this.currentBrandId);
  }

  get publicTemplates(): ReleaseTaskTemplate[] {
    return this.templates.filter(t => t.is_public && t.brand_id !== this.currentBrandId);
  }

  toggleExpand(id: number): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  apply(template: ReleaseTaskTemplate): void {
    if (this.applyingId) return;
    this.applyingId = template.id;
    this.templateService.applyTemplate(this.releaseId, template.id).subscribe({
      next: (res) => {
        this.applyingId = null;
        this.applied.emit(res.tasks);
        this.close();
      },
      error: () => {
        this.applyingId = null;
        this.notificationService.showError('Failed to apply template');
      },
    });
  }

  hide(template: ReleaseTaskTemplate, event: Event): void {
    event.stopPropagation();
    this.hidingId = template.id;
    this.templateService.hideTemplate(template.id).subscribe({
      next: () => {
        this.hidingId = null;
        this.templates = this.templates.filter(t => t.id !== template.id);
      },
      error: () => {
        this.hidingId = null;
        this.notificationService.showError('Failed to hide template');
      },
    });
  }

  itemCountLabel(template: ReleaseTaskTemplate): string {
    const n = template.items?.length ?? 0;
    return n === 1 ? '1 task' : `${n} tasks`;
  }

  formatDaysLabel(days: number | null): string {
    if (days == null) return 'No due date';
    if (days === 0) return 'On release day';
    return `${days} day${days !== 1 ? 's' : ''} before`;
  }

  openEditor(): void {
    this.editingTemplate = null;
  }

  openEditTemplate(template: ReleaseTaskTemplate, event: Event): void {
    event.stopPropagation();
    this.editingTemplate = template;
  }

  onEditorSaved(template: ReleaseTaskTemplate): void {
    this.editingTemplate = undefined;
    this.load();
  }

  onEditorCancelled(): void {
    this.editingTemplate = undefined;
  }

  close(): void {
    this.closed.emit();
  }
}
