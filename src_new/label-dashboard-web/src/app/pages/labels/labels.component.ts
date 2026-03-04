import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LabelFinanceTabComponent } from '../admin/components/label-finance-tab.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-labels',
  imports: [CommonModule, BreadcrumbComponent, LabelFinanceTabComponent],
  templateUrl: './labels.component.html',
  styleUrls: []
})
export class LabelsComponent {}
