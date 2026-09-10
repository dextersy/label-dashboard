import { Component, Input, Output, EventEmitter, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReleaseTaskTemplateService } from '../../../../../services/release-task-template.service';
import { NotificationService } from '../../../../../services/notification.service';
import { ReleaseTaskTemplate, ReleaseTaskTemplateItem, CreateTemplateDto, CreateTemplateItemDto } from '../../../../../models/release-task-template.model';
import { IconComponent } from '../../../../../components/shared/icon/icon.component';
import { ModalToBodyDirective } from '../../../../../directives/modal-to-body.directive';

interface EditableItem {
  title: string;
  notes: string;
  days_before_release: number | null;
}

@Component({
  selector: 'app-template-editor-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ModalToBodyDirective],
  templateUrl: './template-editor-modal.component.html',
  styleUrls: ['../release-planning-tab.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class TemplateEditorModalComponent implements OnInit {
  @Input() template: ReleaseTaskTemplate | null = null; // null = create mode
  @Output() saved = new EventEmitter<ReleaseTaskTemplate>();
  @Output() cancelled = new EventEmitter<void>();

  name = '';
  description = '';
  isPublic = false;
  items: EditableItem[] = [];
  saving = false;

  constructor(
    private templateService: ReleaseTaskTemplateService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    if (this.template) {
      this.name = this.template.name;
      this.description = this.template.description || '';
      this.isPublic = this.template.is_public;
      this.items = (this.template.items || []).map(item => ({
        title: item.title,
        notes: item.notes || '',
        days_before_release: item.days_before_release,
      }));
    }
    if (this.items.length === 0) {
      this.addItem();
    }
  }

  addItem(): void {
    this.items.push({ title: '', notes: '', days_before_release: null });
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
  }

  moveUp(index: number): void {
    if (index === 0) return;
    const temp = this.items[index - 1];
    this.items[index - 1] = this.items[index];
    this.items[index] = temp;
  }

  moveDown(index: number): void {
    if (index === this.items.length - 1) return;
    const temp = this.items[index + 1];
    this.items[index + 1] = this.items[index];
    this.items[index] = temp;
  }

  get isValid(): boolean {
    return this.name.trim().length > 0;
  }

  save(): void {
    if (!this.isValid || this.saving) return;
    this.saving = true;

    const itemDtos: CreateTemplateItemDto[] = this.items
      .filter(i => i.title.trim().length > 0)
      .map((i, index) => ({
        title: i.title.trim(),
        notes: i.notes.trim() || undefined,
        days_before_release: i.days_before_release,
        sort_order: index,
      }));

    if (this.template) {
      this.templateService.updateTemplate(this.template.id, {
        name: this.name.trim(),
        description: this.description.trim() || undefined,
        is_public: this.isPublic,
        items: itemDtos,
      }).subscribe({
        next: (res) => {
          this.saving = false;
          this.saved.emit(res.template);
        },
        error: () => {
          this.saving = false;
          this.notificationService.showError('Failed to save template');
        },
      });
    } else {
      const dto: CreateTemplateDto = {
        name: this.name.trim(),
        description: this.description.trim() || undefined,
        is_public: this.isPublic,
        items: itemDtos,
      };
      this.templateService.createTemplate(dto).subscribe({
        next: (res) => {
          this.saving = false;
          this.saved.emit(res.template);
        },
        error: () => {
          this.saving = false;
          this.notificationService.showError('Failed to create template');
        },
      });
    }
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
