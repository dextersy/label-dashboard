import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-lightbox',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lightbox.component.html',
  styleUrl: './lightbox.component.scss'
})
export class LightboxComponent implements OnInit, OnDestroy {
  @Input() imageUrl: string = '';
  @Input() imageAlt: string = '';
  @Input() caption: string = '';
  @Input() isVisible: boolean = false;
  @Output() close = new EventEmitter<void>();

  private originalBodyOverflow: string = '';
  currentZoom: number = 1;
  isDragging: boolean = false;
  dragStart = { x: 0, y: 0 };
  imagePosition = { x: 0, y: 0 };
  lastPanPoint = { x: 0, y: 0 };

  ngOnInit(): void {
    if (this.isVisible) {
      this.preventBodyScroll();
    }
  }

  ngOnDestroy(): void {
    this.restoreBodyScroll();
  }

  ngOnChanges(): void {
    if (this.isVisible) {
      this.preventBodyScroll();
      this.resetZoomAndPosition();
    } else {
      this.restoreBodyScroll();
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (!this.isVisible) return;

    switch (event.key) {
      case 'Escape':
        this.closeLightbox();
        break;
      case '+':
      case '=':
        event.preventDefault();
        this.zoomIn();
        break;
      case '-':
        event.preventDefault();
        this.zoomOut();
        break;
      case '0':
        event.preventDefault();
        this.resetZoomAndPosition();
        break;
    }
  }

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    if (!this.isVisible) return;
    
    event.preventDefault();
    
    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  preventBodyScroll(): void {
    this.originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  restoreBodyScroll(): void {
    document.body.style.overflow = this.originalBodyOverflow;
  }

  closeLightbox(): void {
    this.close.emit();
  }

  zoomIn(): void {
    this.currentZoom = Math.min(this.currentZoom * 1.2, 5);
  }

  zoomOut(): void {
    this.currentZoom = Math.max(this.currentZoom / 1.2, 0.1);
    
    // Reset position if zoomed out to 1x or less
    if (this.currentZoom <= 1) {
      this.imagePosition = { x: 0, y: 0 };
    }
  }

  resetZoomAndPosition(): void {
    this.currentZoom = 1;
    this.imagePosition = { x: 0, y: 0 };
  }

  onMouseDown(event: MouseEvent): void {
    if (this.currentZoom <= 1) return;
    
    event.preventDefault();
    this.isDragging = true;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.lastPanPoint = { x: this.imagePosition.x, y: this.imagePosition.y };
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.isVisible) return;

    const deltaX = event.clientX - this.dragStart.x;
    const deltaY = event.clientY - this.dragStart.y;
    
    this.imagePosition = {
      x: this.lastPanPoint.x + deltaX,
      y: this.lastPanPoint.y + deltaY
    };
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isDragging = false;
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeLightbox();
    }
  }

  getImageTransform(): string {
    return `translate(${this.imagePosition.x}px, ${this.imagePosition.y}px) scale(${this.currentZoom})`;
  }
}