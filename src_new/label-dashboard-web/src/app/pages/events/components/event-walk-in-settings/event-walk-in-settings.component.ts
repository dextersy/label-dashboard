import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface WalkInType {
  id?: number;
  name: string;
  price: number;
  max_slots: number;
}

@Component({
    selector: 'app-event-walk-in-settings',
    imports: [CommonModule, FormsModule],
    templateUrl: './event-walk-in-settings.component.html',
    styleUrl: './event-walk-in-settings.component.scss'
})
export class EventWalkInSettingsComponent implements OnChanges {
  @Input() isAdmin: boolean = false;
  @Input() eventData: any = null;
  @Input() walkInTypes: WalkInType[] = [];
  @Output() walkInTypesChange = new EventEmitter<WalkInType[]>();

  // Max count toggle
  isMaxCountUnlimited = true;

  // Add/edit form
  showNewForm = false;
  editingIndex: number | null = null;
  typeForm = {
    name: '',
    price: 0,
    max_slots: 0,
    isFree: true,
    isUnlimited: true
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['eventData'] && this.eventData) {
      this.isMaxCountUnlimited = !this.eventData.walk_in_max_count || this.eventData.walk_in_max_count === 0;
    }
  }

  onMaxCountUnlimitedChange(unlimited: boolean): void {
    this.isMaxCountUnlimited = unlimited;
    if (unlimited) {
      this.eventData.walk_in_max_count = 0;
    }
  }

  startAddNew(): void {
    this.editingIndex = null;
    this.typeForm = { name: '', price: 0, max_slots: 0, isFree: true, isUnlimited: true };
    this.showNewForm = true;
  }

  startEdit(index: number): void {
    const type = this.walkInTypes[index];
    this.editingIndex = index;
    this.typeForm = {
      name: type.name,
      price: type.price,
      max_slots: type.max_slots,
      isFree: !type.price || type.price === 0,
      isUnlimited: type.max_slots === 0
    };
    this.showNewForm = false;
  }

  cancelForm(): void {
    this.showNewForm = false;
    this.editingIndex = null;
  }

  saveEdit(): void {
    if (this.editingIndex === null || !this.typeForm.name.trim()) return;

    this.walkInTypes[this.editingIndex] = {
      ...this.walkInTypes[this.editingIndex],
      name: this.typeForm.name.trim(),
      price: this.typeForm.isFree ? 0 : (Number(this.typeForm.price) || 0),
      max_slots: this.typeForm.isUnlimited ? 0 : (Number(this.typeForm.max_slots) || 0)
    };

    this.editingIndex = null;
    this.walkInTypesChange.emit([...this.walkInTypes]);
  }

  saveNew(): void {
    if (!this.typeForm.name.trim()) return;

    this.walkInTypes = [...this.walkInTypes, {
      name: this.typeForm.name.trim(),
      price: this.typeForm.isFree ? 0 : (Number(this.typeForm.price) || 0),
      max_slots: this.typeForm.isUnlimited ? 0 : (Number(this.typeForm.max_slots) || 0)
    }];

    this.showNewForm = false;
    this.walkInTypesChange.emit([...this.walkInTypes]);
  }

  deleteType(index: number): void {
    const type = this.walkInTypes[index];
    if (!confirm(`Delete "${type.name}"? This cannot be undone.`)) return;

    this.walkInTypes = this.walkInTypes.filter((_, i) => i !== index);
    this.walkInTypesChange.emit([...this.walkInTypes]);
  }

  formatPrice(price: number): string {
    if (!price || price === 0) return 'FREE';
    return '₱' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
