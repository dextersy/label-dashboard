import { Directive, ElementRef, Renderer2, OnInit, OnDestroy } from '@angular/core';

/**
 * Directive to move modal elements to document.body to escape positioning contexts.
 *
 * Usage: Add [appModalToBody] to any modal element
 * <div class="modal" [appModalToBody]>...</div>
 *
 * This solves the issue where parent containers with position:relative or transform
 * properties create new positioning contexts, causing position:fixed modals to be
 * positioned relative to the container instead of the viewport.
 */
@Directive({
  selector: '[appModalToBody]',
  standalone: true
})
export class ModalToBodyDirective implements OnInit, OnDestroy {
  private originalParent: HTMLElement | null = null;
  private element: HTMLElement;

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {
    this.element = this.elementRef.nativeElement;
  }

  ngOnInit(): void {
    // Store the original parent
    this.originalParent = this.element.parentElement;

    // Move the element to body
    this.renderer.appendChild(document.body, this.element);
  }

  ngOnDestroy(): void {
    // When destroyed (for example due to *ngIf turning false), remove the element
    // from the body so it does not remain visible as an orphaned overlay.
    if (this.element.parentElement === document.body) {
      this.renderer.removeChild(document.body, this.element);
    }
  }
}
