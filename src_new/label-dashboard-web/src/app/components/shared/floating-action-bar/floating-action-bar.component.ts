import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-floating-action-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-action-bar.component.html',
  styleUrl: './floating-action-bar.component.scss',
})
export class FloatingActionBarComponent implements AfterViewInit, OnDestroy {
  /** True when both the secondary (default) slot and primary slot have content. */
  drawerMode = false;
  /** Whether the secondary-button drawer is currently open (mobile only). */
  drawerOpen = false;
  /** True when the primary slot has content — shows the fab-end section. */
  showFabEnd = false;

  @ViewChild('secondarySlot') private secondarySlot!: ElementRef<HTMLElement>;
  @ViewChild('primarySlot') private primarySlot!: ElementRef<HTMLElement>;

  private observer?: MutationObserver;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngAfterViewInit() {
    // Defer to avoid ExpressionChangedAfterItHasBeenCheckedError on the first cycle.
    Promise.resolve().then(() => this.updateState());

    this.observer = new MutationObserver(() =>
      this.ngZone.run(() => this.updateState())
    );
    this.observer.observe(this.secondarySlot.nativeElement, { childList: true });
    this.observer.observe(this.primarySlot.nativeElement, { childList: true });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  private updateState() {
    const hasSecondary = this.secondarySlot.nativeElement.children.length > 0;
    const hasPrimary = this.primarySlot.nativeElement.children.length > 0;
    this.drawerMode = hasPrimary && hasSecondary;
    this.showFabEnd = hasPrimary;
    if (!this.drawerMode) {
      this.drawerOpen = false;
    }
    // Force immediate re-render so class bindings (drawer-mode, fab-end--visible)
    // are applied in the same tick rather than waiting for the next CD trigger.
    this.cdr.detectChanges();
  }

  toggleDrawer() {
    this.drawerOpen = !this.drawerOpen;
  }
}
