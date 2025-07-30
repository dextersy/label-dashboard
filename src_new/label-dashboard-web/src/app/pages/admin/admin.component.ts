import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandSettingsTabComponent } from './components/brand-settings-tab.component';
import { SummaryViewTabComponent } from './components/summary-view-tab.component';
import { BalanceSummaryTabComponent } from './components/balance-summary-tab.component';
import { BulkAddEarningsTabComponent } from './components/bulk-add-earnings-tab.component';
import { UsersTabComponent } from './components/users-tab.component';
import { ChildBrandsTabComponent } from './components/child-brands-tab.component';
import { ToolsTabComponent } from './components/tools-tab.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule, 
    BrandSettingsTabComponent, 
    SummaryViewTabComponent, 
    BalanceSummaryTabComponent, 
    BulkAddEarningsTabComponent, 
    UsersTabComponent, 
    ChildBrandsTabComponent, 
    ToolsTabComponent
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  activeTab: string = 'brand';

  constructor() {}

  ngOnInit(): void {
    // Component initialization is now handled by individual tab components
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
}