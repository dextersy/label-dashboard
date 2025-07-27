import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-expense-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-expense-dialog.component.html',
  styleUrl: './add-expense-dialog.component.scss'
})
export class AddExpenseDialogComponent {
  @Input() isVisible: boolean = false;
  @Input() releaseId: number = 0;
  @Input() releaseTitle: string = '';
  @Input() isSubmitting: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<any>();

  expenseForm = {
    expense_description: '',
    expense_amount: '',
    date_recorded: new Date().toISOString().split('T')[0]
  };

  ngOnChanges(): void {
    if (this.isVisible) {
      this.resetForm();
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onSubmit(): void {
    if (!this.expenseForm.expense_description || !this.expenseForm.expense_amount) {
      return;
    }

    const expenseData = {
      release_id: this.releaseId,
      release_title: this.releaseTitle,
      expense_description: this.expenseForm.expense_description,
      expense_amount: this.expenseForm.expense_amount,
      date_recorded: this.expenseForm.date_recorded
    };

    this.submit.emit(expenseData);
  }

  private resetForm(): void {
    this.expenseForm = {
      expense_description: '',
      expense_amount: '',
      date_recorded: new Date().toISOString().split('T')[0]
    };
  }

  get isFormValid(): boolean {
    return !!(this.expenseForm.expense_description && this.expenseForm.expense_amount);
  }
}