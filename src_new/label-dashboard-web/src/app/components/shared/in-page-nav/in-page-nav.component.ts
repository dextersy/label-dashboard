import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
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
export class InPageNavComponent implements AfterViewInit, OnChanges {
  @Input() tabs: InPageNavTab[] = [];
  @Input() activeTab: string = '';
  @Output() tabChange = new EventEmitter<string>();

  @ViewChild('sidebarEl') sidebarEl?: ElementRef<HTMLElement>;

  showRightFade = false;
  showLeftFade = false;

  get stackLayout(): boolean {
    return this.tabs.length > 2;
  }

  ngAfterViewInit(): void {
    // Small delay to let layout settle before measuring
    setTimeout(() => this.checkScrollFade(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tabs']) {
      setTimeout(() => this.checkScrollFade(), 0);
    }
  }

  onSidebarScroll(): void {
    this.checkScrollFade();
  }

  private checkScrollFade(): void {
    const el = this.sidebarEl?.nativeElement;
    if (!el) return;
    const canScroll = el.scrollWidth > el.clientWidth;
    const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
    this.showRightFade = canScroll && !atEnd;
    this.showLeftFade = el.scrollLeft > 1;
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
