import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LabelFinanceTabComponent } from '../admin/components/label-finance-tab.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-labels-earnings-page',
  imports: [CommonModule, BreadcrumbComponent, LabelFinanceTabComponent],
  templateUrl: './labels-earnings.component.html',
  styleUrls: []
})
export class LabelsEarningsPageComponent {}
