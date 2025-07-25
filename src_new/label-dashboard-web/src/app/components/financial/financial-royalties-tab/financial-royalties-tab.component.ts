import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoyaltiesTableComponent } from '../royalties-table/royalties-table.component';
import { Royalty } from '../../../pages/financial/financial.component';

@Component({
  selector: 'app-financial-royalties-tab',
  standalone: true,
  imports: [CommonModule, RoyaltiesTableComponent],
  templateUrl: './financial-royalties-tab.component.html',
  styleUrl: './financial-royalties-tab.component.scss'
})
export class FinancialRoyaltiesTabComponent {
  @Input() royalties: Royalty[] = [];
}