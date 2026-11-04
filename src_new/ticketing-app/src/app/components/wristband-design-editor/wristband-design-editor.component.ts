import {
  Component, Input, Output, EventEmitter, OnDestroy,
  ViewChild, ElementRef, HostListener, OnChanges, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DesignPos { x: number; y: number; width: number; height: number; }
export interface WristbandColorOption { id: number; slug: string; label: string; bg_color: string; }

@Component({
  selector: 'app-wristband-design-editor',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    /* ── Outer canvas shell ───────────────────────────────────────────────── */
    .preview-canvas {
      position: relative;
      width: 100%;
      padding-bottom: 10.7%;
      border-radius: 4px;
      overflow: hidden;
      user-select: none;
    }
    .preview-canvas.is-interacting * { cursor: inherit !important; }

    /* Absolute fill so children get real pixel dimensions */
    .canvas-inner { position: absolute; inset: 0; }

    /* ── Wristband band color background ──────────────────────────────────── */
    /* Band: left 16.7% → right 95%, top 18% → bottom 82%                    */
    .printable-bg {
      position: absolute;
      left: 16.7%; right: 5%;
      top: 18%; bottom: 18%;
      pointer-events: none;
      z-index: 1;
    }

    /* ── Dark dimmer strips outside the template area ─────────────────────── */
    .dimmer {
      position: absolute;
      background: rgba(0,0,0,0.45);
      pointer-events: none;
      z-index: 10;
    }
    .dimmer-top    { top: 0;    left: 0;   right: 0;   height: 18%; }
    .dimmer-bottom { bottom: 0; left: 0;   right: 0;   height: 18%; }
    .dimmer-left   { left: 0;   width: 5%; top: 18%;   bottom: 18%; }
    .dimmer-right  { right: 0;  width: 5%; top: 18%;   bottom: 18%; }

    /* ── Template area guides ─────────────────────────────────────────────── */
    .template-area {
      position: absolute;
      left: 5%; right: 5%;
      top: 18%; bottom: 18%;
      pointer-events: none;
      z-index: 20;
    }

    /* Snap closure strip: left 0–13% of template, band height 28–72% */
    .snap-zone {
      position: absolute;
      left: 0; width: 13%;
      top: 28%; bottom: 28%;
      border-right: 1.5px solid rgba(255,255,255,0.65);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .snap-label {
      font-size: 0.45rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.7);
      text-align: center;
      line-height: 1.4;
    }

    /* Printable area frame: 13–99% of template width, band height 28–72% */
    .printable-frame {
      position: absolute;
      left: 13%; right: 1%;
      top: 28%; bottom: 28%;
      border: 1.5px solid rgba(255,255,255,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .printable-label {
      font-size: 0.45rem;
      font-style: italic;
      color: rgba(255,255,255,0.65);
      letter-spacing: 0.08em;
      white-space: nowrap;
    }

    /* ── Design overlay (draggable/resizable) ─────────────────────────────── */
    .design-overlay {
      position: absolute;
      cursor: move;
      z-index: 15;
      outline: 1.5px dashed rgba(255,255,255,0.85);
      outline-offset: -1px;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.35);
      touch-action: none;
    }
    .design-overlay:hover { outline-color: #fff; }

    .design-img {
      width: 100%; height: 100%;
      object-fit: contain; display: block;
      pointer-events: none;
      mix-blend-mode: multiply;
    }

    /* ── Resize handles ───────────────────────────────────────────────────── */
    .rh {
      position: absolute;
      width: 10px; height: 10px;
      background: #fff;
      border: 1.5px solid #3b82f6;
      border-radius: 2px;
      z-index: 10;
    }
    .rh.nw { top: -5px;  left: -5px;  cursor: nw-resize; }
    .rh.n  { top: -5px;  left: calc(50% - 5px); cursor: n-resize; }
    .rh.ne { top: -5px;  right: -5px; cursor: ne-resize; }
    .rh.e  { top: calc(50% - 5px); right: -5px; cursor: e-resize; }
    .rh.se { bottom: -5px; right: -5px; cursor: se-resize; }
    .rh.s  { bottom: -5px; left: calc(50% - 5px); cursor: s-resize; }
    .rh.sw { bottom: -5px; left: -5px; cursor: sw-resize; }
    .rh.w  { top: calc(50% - 5px); left: -5px; cursor: w-resize; }

    /* ── Empty-state upload prompt ────────────────────────────────────────── */
    .upload-prompt {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 6px;
      color: rgba(255,255,255,0.9);
      font-size: 0.8rem;
      cursor: pointer;
      background: rgba(0,0,0,0.22);
      transition: background 0.2s;
      z-index: 30;
    }
    .upload-prompt:hover { background: rgba(0,0,0,0.32); }
    .upload-prompt svg { opacity: 0.85; }

    /* ── Color swatch row ─────────────────────────────────────────────────── */
    .color-swatch {
      width: 20px; height: 20px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform 0.15s, border-color 0.15s;
      flex-shrink: 0;
    }
    .color-swatch.active {
      border-color: #111;
      transform: scale(1.15);
    }
    .color-swatch:not(.active) { opacity: 0.65; }
  `],
  template: `
<div>
  <!-- Color preview selector (shown when design loaded and colors available) -->
  @if (designDataUrl && colors.length > 0) {
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
      <span style="font-size:0.7rem; font-family:monospace; text-transform:uppercase; letter-spacing:0.08em; color:#9ca3af;">Preview:</span>
      @for (c of colors; track c.id) {
        <button type="button"
          class="color-swatch"
          [class.active]="activeColorId === c.id"
          [style.background]="c.bg_color"
          [title]="c.label"
          (click)="activeColorId = c.id">
        </button>
      }
    </div>
  }

  <!-- Canvas -->
  <div class="preview-canvas" [class.is-interacting]="isDragging" #previewContainer>
    <div class="canvas-inner">

      <!-- Wristband band color fill -->
      <div class="printable-bg" [style.background-color]="activeColor?.bg_color || '#e5e7eb'"></div>

      <!-- Outside-template dimmers -->
      <div class="dimmer dimmer-top"></div>
      <div class="dimmer dimmer-bottom"></div>
      <div class="dimmer dimmer-left"></div>
      <div class="dimmer dimmer-right"></div>

      <!-- Template guides (snap zone + printable frame) -->
      <div class="template-area">
        <div class="snap-zone">
          <span class="snap-label">Snap<br>Closure</span>
        </div>
        <div class="printable-frame">
          <span class="printable-label">Printable Area</span>
        </div>
      </div>

      <!-- Design overlay -->
      @if (designDataUrl) {
        <div class="design-overlay"
          [style.left.px]="designPos.x"
          [style.top.px]="designPos.y"
          [style.width.px]="designPos.width"
          [style.height.px]="designPos.height"
          (mousedown)="startDrag($event)"
          (touchstart)="startDragTouch($event)">
          <img [src]="designDataUrl" class="design-img" draggable="false" />
          <div class="rh nw" (mousedown)="startResize($event,'nw')" (touchstart)="startResizeTouch($event,'nw')"></div>
          <div class="rh n"  (mousedown)="startResize($event,'n')"  (touchstart)="startResizeTouch($event,'n')"></div>
          <div class="rh ne" (mousedown)="startResize($event,'ne')" (touchstart)="startResizeTouch($event,'ne')"></div>
          <div class="rh e"  (mousedown)="startResize($event,'e')"  (touchstart)="startResizeTouch($event,'e')"></div>
          <div class="rh se" (mousedown)="startResize($event,'se')" (touchstart)="startResizeTouch($event,'se')"></div>
          <div class="rh s"  (mousedown)="startResize($event,'s')"  (touchstart)="startResizeTouch($event,'s')"></div>
          <div class="rh sw" (mousedown)="startResize($event,'sw')" (touchstart)="startResizeTouch($event,'sw')"></div>
          <div class="rh w"  (mousedown)="startResize($event,'w')"  (touchstart)="startResizeTouch($event,'w')"></div>
        </div>
      }

      <!-- Processing state -->
      @if (processing) {
        <div class="upload-prompt" style="cursor:default; pointer-events:none;">
          <span style="font-family:monospace; font-size:0.75rem; color:rgba(255,255,255,0.8);">Processing…</span>
        </div>
      }

      <!-- Empty upload prompt -->
      @if (!designDataUrl && !processing) {
        <div class="upload-prompt" (click)="triggerFileInput()">
          <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
          </svg>
          <span>Click to upload your design</span>
        </div>
      }

    </div>
  </div>

  <!-- Controls below canvas -->
  <div style="display:flex; align-items:center; gap:12px; margin-top:8px; flex-wrap:wrap;">
    <input #fileInput type="file" [accept]="accept" style="display:none" (change)="onFileChange($event)" />

    <button type="button" (click)="triggerFileInput()" [disabled]="processing"
      style="font-size:0.7rem; font-family:monospace; text-transform:uppercase; letter-spacing:0.08em; color:#6b7280; cursor:pointer; background:none; border:none; padding:0; display:inline-flex; align-items:center; gap:4px;"
      onmouseover="this.style.color='#374151'" onmouseout="this.style.color='#6b7280'">
      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
      </svg>
      {{ designDataUrl ? 'Replace file' : 'Upload design' }}
    </button>

    @if (designDataUrl) {
      <button type="button" (click)="resetDesignPos()"
        style="font-size:0.7rem; font-family:monospace; text-transform:uppercase; letter-spacing:0.08em; color:#6b7280; cursor:pointer; background:none; border:none; padding:0;"
        onmouseover="this.style.color='#374151'" onmouseout="this.style.color='#6b7280'">
        Reset position
      </button>
      <button type="button" (click)="removeDesign()"
        style="font-size:0.7rem; font-family:monospace; text-transform:uppercase; letter-spacing:0.08em; color:#d1d5db; cursor:pointer; background:none; border:none; padding:0; margin-left:auto;"
        onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#d1d5db'">
        Remove
      </button>
    }
  </div>

  @if (error) {
    <p style="font-size:0.75rem; color:#ef4444; margin-top:6px;">{{ error }}</p>
  }
</div>
  `,
})
export class WristbandDesignEditorComponent implements OnChanges, OnDestroy {
  /** Wristband colors to show in the preview color selector. Pass only colors with quantity > 0. */
  @Input() colors: WristbandColorOption[] = [];
  /** Accepted file types. Defaults to PNG only. */
  @Input() accept = 'image/png';
  /** Error message to display (from parent validation or upload errors). */
  @Input() error = '';
  /** Processing state (parent is handling an async operation). */
  @Input() processing = false;

  /** Emitted whenever the design data URL changes (null = removed). */
  @Output() designChange = new EventEmitter<string | null>();
  /** Emitted on mouseup/touchend after a drag or resize. */
  @Output() positionChange = new EventEmitter<{ pos: DesignPos; canvasWidth: number }>();

  @ViewChild('previewContainer') previewContainer!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // ── Canvas layout constants ────────────────────────────────────────────────
  private readonly TMPL_L = 0.05;
  private readonly TMPL_T = 0.18;
  private readonly TMPL_W = 0.90;
  private readonly TMPL_H = 0.64;
  private readonly BAND_L = 0.13;
  private readonly BAND_R = 0.99;
  private readonly BAND_T = 0.28;
  private readonly BAND_B = 0.72;
  private readonly MIN_SIZE = 10;

  // ── State ──────────────────────────────────────────────────────────────────
  designDataUrl: string | null = null;
  designPos: DesignPos = { x: 60, y: 20, width: 240, height: 80 };
  activeColorId: number | null = null;

  private _dragging = false;
  private _resizing = false;
  private _resizeHandle = '';
  private _dragStartX = 0;
  private _dragStartY = 0;
  private _startPos: DesignPos = { x: 0, y: 0, width: 0, height: 0 };

  get isDragging(): boolean { return this._dragging || this._resizing; }

  get activeColor(): WristbandColorOption | null {
    if (this.colors.length === 0) return null;
    return this.colors.find(c => c.id === this.activeColorId) ?? this.colors[0];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['colors'] && this.colors.length > 0 && this.activeColorId === null) {
      this.activeColorId = this.colors[0].id;
    }
  }

  ngOnDestroy(): void {}

  // ── Public API (called via ViewChild from parent) ──────────────────────────

  /** Load a design from a URL (e.g. existing saved design), restore optional saved position. */
  loadFromUrl(url: string, savedPos?: { x: number; y: number; width: number; height: number; canvasWidth: number }): void {
    this.processing = true;
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('Failed to fetch design'); return r.blob(); })
      .then(blob => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }))
      .then(dataUrl => this.processImage(dataUrl))
      .then(processed => {
        this.designDataUrl = processed;
        this.processing = false;
        if (savedPos?.canvasWidth) {
          const b = this.getPreviewBounds();
          const scale = b.width / savedPos.canvasWidth;
          this.designPos = {
            x:      Math.round(savedPos.x * scale),
            y:      Math.round(savedPos.y * scale),
            width:  Math.round(savedPos.width * scale),
            height: Math.round(savedPos.height * scale),
          };
        } else {
          this.resetDesignPos();
        }
      })
      .catch(() => { this.processing = false; });
  }

  /** Get the current canvas pixel width (for saving canvas_width). */
  getCanvasWidth(): number {
    return this.getPreviewBounds().width;
  }

  // ── File input ─────────────────────────────────────────────────────────────

  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.processing = true;
    this.error = '';
    const reader = new FileReader();
    reader.onload = e => {
      this.processImage(e.target?.result as string)
        .then(processed => {
          this.designDataUrl = processed;
          this.processing = false;
          this.resetDesignPos();
          this.designChange.emit(processed);
        })
        .catch(err => {
          this.designDataUrl = null;
          this.processing = false;
          this.error = err.message;
          this.designChange.emit(null);
        });
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeDesign(): void {
    this.designDataUrl = null;
    this.error = '';
    this.designChange.emit(null);
  }

  // ── Position reset ─────────────────────────────────────────────────────────

  resetDesignPos(): void {
    const b = this.getPreviewBounds();
    const bandLeft   = b.width  * (this.TMPL_L + this.TMPL_W * this.BAND_L);
    const bandRight  = b.width  * (this.TMPL_L + this.TMPL_W * this.BAND_R);
    const bandTop    = b.height * (this.TMPL_T + this.TMPL_H * this.BAND_T);
    const bandBottom = b.height * (this.TMPL_T + this.TMPL_H * this.BAND_B);
    const bw = bandRight - bandLeft;
    const bh = bandBottom - bandTop;
    this.designPos = {
      x:      Math.round(bandLeft + bw * 0.05),
      y:      Math.round(bandTop  + bh * 0.1),
      width:  Math.round(bw * 0.55),
      height: Math.round(bh * 0.8),
    };
  }

  // ── Drag & resize ──────────────────────────────────────────────────────────

  startDrag(event: MouseEvent): void {
    if (this._resizing) return;
    this._dragging = true;
    this._dragStartX = event.clientX; this._dragStartY = event.clientY;
    this._startPos = { ...this.designPos };
    event.preventDefault();
  }

  startDragTouch(event: TouchEvent): void {
    if (this._resizing) return;
    const t = event.touches[0];
    this._dragging = true;
    this._dragStartX = t.clientX; this._dragStartY = t.clientY;
    this._startPos = { ...this.designPos };
  }

  startResize(event: MouseEvent, handle: string): void {
    this._resizing = true; this._resizeHandle = handle;
    this._dragStartX = event.clientX; this._dragStartY = event.clientY;
    this._startPos = { ...this.designPos };
    event.preventDefault(); event.stopPropagation();
  }

  startResizeTouch(event: TouchEvent, handle: string): void {
    const t = event.touches[0];
    this._resizing = true; this._resizeHandle = handle;
    this._dragStartX = t.clientX; this._dragStartY = t.clientY;
    this._startPos = { ...this.designPos };
    event.stopPropagation();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this._dragging && !this._resizing) return;
    const dx = event.clientX - this._dragStartX;
    const dy = event.clientY - this._dragStartY;
    const b  = this.getPreviewBounds();
    if (this._dragging) {
      this.designPos = {
        ...this.designPos,
        x: Math.max(0, Math.min(b.width  - this.designPos.width,  this._startPos.x + dx)),
        y: Math.max(0, Math.min(b.height - this.designPos.height, this._startPos.y + dy)),
      };
    }
    if (this._resizing) {
      let { x, y, width, height } = this._startPos;
      if (this._resizeHandle.length === 2) {
        const aspect = this._startPos.width / this._startPos.height;
        const pdx = this._resizeHandle.includes('e') ? dx : -dx;
        const pdy = this._resizeHandle.includes('s') ? dy : -dy;
        const delta = Math.abs(pdx) >= Math.abs(pdy) ? pdx : pdy * aspect;
        const nw = Math.max(this.MIN_SIZE, width + delta), nh = nw / aspect;
        if (this._resizeHandle.includes('w')) x = Math.max(0, x + width - nw);
        if (this._resizeHandle.includes('n')) y = Math.max(0, y + height - nh);
        width = nw; height = nh;
      } else {
        if (this._resizeHandle === 'e') width  = Math.max(this.MIN_SIZE, width  + dx);
        if (this._resizeHandle === 's') height = Math.max(this.MIN_SIZE, height + dy);
        if (this._resizeHandle === 'w') { const r = x + width; const nw = Math.max(this.MIN_SIZE, width - dx); x = Math.max(0, r - nw); width = r - x; }
        if (this._resizeHandle === 'n') { const bot = y + height; const nh = Math.max(this.MIN_SIZE, height - dy); y = Math.max(0, bot - nh); height = bot - y; }
      }
      this.designPos = { x, y, width, height };
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    if (this._dragging || this._resizing) {
      this._dragging = false; this._resizing = false;
      this.positionChange.emit({ pos: { ...this.designPos }, canvasWidth: this.getCanvasWidth() });
    }
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this._dragging && !this._resizing) return;
    const t = event.touches[0];
    this.onMouseMove({ clientX: t.clientX, clientY: t.clientY } as MouseEvent);
  }

  @HostListener('document:touchend')
  onTouchEnd(): void {
    if (this._dragging || this._resizing) {
      this._dragging = false; this._resizing = false;
      this.positionChange.emit({ pos: { ...this.designPos }, canvasWidth: this.getCanvasWidth() });
    }
  }

  // ── Image processing ───────────────────────────────────────────────────────

  processImage(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const W = img.naturalWidth, H = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, W, H);
        const data = imageData.data;

        let hasTransparent = false, hasNonBlackOpaque = false;
        const BT = 40;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) { hasTransparent = true; }
          else if (data[i] + data[i + 1] + data[i + 2] > BT * 3) { hasNonBlackOpaque = true; }
          if (hasTransparent && hasNonBlackOpaque) break;
        }
        if (hasTransparent && !hasNonBlackOpaque) { resolve(canvas.toDataURL('image/png')); return; }

        const patchSize = Math.min(5, Math.floor(Math.min(W, H) / 4));
        const samples: [number, number, number][] = [];
        for (let py = 0; py < patchSize; py++) {
          for (let px = 0; px < patchSize; px++) {
            for (const [cx, cy] of [[px, py], [W - 1 - px, py], [px, H - 1 - py], [W - 1 - px, H - 1 - py]]) {
              const i = (cy * W + cx) * 4;
              samples.push([data[i], data[i + 1], data[i + 2]]);
            }
          }
        }
        const avg: [number, number, number] = [
          samples.reduce((s, c) => s + c[0], 0) / samples.length,
          samples.reduce((s, c) => s + c[1], 0) / samples.length,
          samples.reduce((s, c) => s + c[2], 0) / samples.length,
        ];
        const variance = samples.reduce((s, c) => s + Math.abs(c[0] - avg[0]) + Math.abs(c[1] - avg[1]) + Math.abs(c[2] - avg[2]), 0) / samples.length;
        if (variance > 80) {
          reject(new Error('Image not suitable: use a solid-colour background with solid black artwork.'));
          return;
        }
        const TOL = 45;
        let opaquePixels = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue;
          const dist = Math.sqrt((data[i] - avg[0]) ** 2 + (data[i + 1] - avg[1]) ** 2 + (data[i + 2] - avg[2]) ** 2);
          if (dist <= TOL) { data[i + 3] = 0; }
          else { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; opaquePixels++; }
        }
        if (opaquePixels / (W * H) < 0.005) {
          reject(new Error('Image not suitable: use a solid-colour background with solid black artwork.'));
          return;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Could not load the image file.'));
      img.src = dataUrl;
    });
  }

  private getPreviewBounds(): { width: number; height: number } {
    if (this.previewContainer?.nativeElement) {
      const el = this.previewContainer.nativeElement;
      return { width: el.clientWidth, height: el.clientHeight };
    }
    return { width: 700, height: 75 };
  }
}
