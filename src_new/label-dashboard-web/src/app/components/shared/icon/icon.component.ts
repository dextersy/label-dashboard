import { Component, Input, HostBinding, OnChanges, inject, booleanAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICON_REGISTRY } from './icon.registry';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: '',
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      vertical-align: -0.125em;
      margin-right: 0.3em;
    }
    :host(.icon-only) {
      margin-right: 0;
    }
  `]
})
export class IconComponent implements OnChanges {
  @Input() name: string = '';
  @Input() size: number | null = null;
  @Input({ transform: booleanAttribute }) @HostBinding('class.icon-only') iconOnly: boolean = false;

  @HostBinding('innerHTML') html: SafeHtml = '';

  private sanitizer = inject(DomSanitizer);

  ngOnChanges(): void {
    const inner = ICON_REGISTRY[this.name];
    if (!inner) {
      this.html = '';
      return;
    }
    const dim = this.size != null ? `${this.size}` : '1em';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision">${inner}</svg>`;
    this.html = this.sanitizer.bypassSecurityTrustHtml(svg);
  }
}
