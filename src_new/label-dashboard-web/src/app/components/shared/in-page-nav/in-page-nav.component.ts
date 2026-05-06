import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IconComponent } from '../icon/icon.component';

export interface InPageNavTab {
  id: string;
  label: string;
  icon: string; // app-icon name, e.g. 'scale'
  /** Greys out the tab and prevents clicking */
  disabled?: boolean;
  /** Trailing status icon: green check, yellow warning, or red error */
  status?: 'completed' | 'warning' | 'error' | null;
  /** 'danger' renders the tab in red (e.g. a Cancel action) */
  color?: 'danger';
  /** Tooltip text; supports newlines for multi-line content */
  tooltip?: string;
}

@Component({
  selector: 'app-in-page-nav',
  standalone: true,
  imports: [CommonModule, MatTooltipModule, IconComponent],
  templateUrl: './in-page-nav.component.html',
  styleUrls: ['./in-page-nav.component.scss']
})
export class InPageNavComponent {
  @Input() tabs: InPageNavTab[] = [];
  @Input() activeTab: string = '';
  @Output() tabChange = new EventEmitter<string>();

  get stackLayout(): boolean {
    return this.tabs.length > 2;
  }

  trackByTabId(_: number, tab: InPageNavTab): string {
    return tab.id;
  }

  onTabClick(tab: InPageNavTab): void {
    if (!tab.disabled) {
      this.tabChange.emit(tab.id);
    }
  }
}
