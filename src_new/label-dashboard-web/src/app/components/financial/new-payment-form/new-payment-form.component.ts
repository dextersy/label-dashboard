import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-new-payment-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-payment-form.component.html',
  styleUrl: './new-payment-form.component.scss'
})
export class NewPaymentFormComponent {
  @Input() newPaymentForm: any = {};
  @Input() onSubmitPayment: () => Promise<void> = async () => {};
}