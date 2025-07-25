import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EarningsTableComponent } from '../earnings-table/earnings-table.component';
import { Earning } from '../../../pages/financial/financial.component';

@Component({
  selector: 'app-financial-earnings-tab',
  standalone: true,
  imports: [CommonModule, EarningsTableComponent],
  templateUrl: './financial-earnings-tab.component.html',
  styleUrl: './financial-earnings-tab.component.scss'
})
export class FinancialEarningsTabComponent {
  @Input() earnings: Earning[] = [];
}