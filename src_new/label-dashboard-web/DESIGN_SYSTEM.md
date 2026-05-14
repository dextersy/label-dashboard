# Label Dashboard Design System

This document describes the design system conventions used in the Angular frontend (`src_new/label-dashboard-web/`). Follow these patterns for all new UI work.

---

## Typography

### Fonts
- **Body:** `"Source Sans 3"`, fallback `-apple-system, BlinkMacSystemFont, "Segoe UI"` — Tailwind token: `tw-font-sans`
- **Headings:** `"Inter"`, fallback `-apple-system, BlinkMacSystemFont, "Segoe UI"` — Tailwind token: `tw-font-heading`
- **Base size:** `13px` globally

### Tab Section Heading

Used to separate named sections within a tab or page body (e.g. "Earnings Summary", "Payment Overview"). Renders as a small muted uppercase label — distinct from card titles.

```html
<h3 class="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-wider tw-text-gray-500 tw-mb-3">Section Name</h3>
```

Use a native `<h3>` tag with Tailwind utility classes — do **not** use a custom CSS class for this pattern. The `h3` tag provides correct semantic hierarchy; the utilities override its default size and color. Always include `tw-mb-3` for spacing below.

---

### Heading scale (global CSS in `styles.scss`)
| Tag | Size | Weight | Letter-spacing | Color |
|-----|------|--------|----------------|-------|
| `h1` | 2.25rem | 700 | -0.03em | `#111827` |
| `h2` | 1.875rem | 700 | -0.025em | `#111827` |
| `h3` | 1.5rem | 700 | -0.02em | `#111827` |
| `h4` | 1.25rem | 700 | -0.015em | `#111827` |
| `h5` | 1rem | 600 | -0.01em | `#1f2937` |
| `h6` | 0.8125rem (13px) | 600 | +0.04em | `#6b7280` — uppercase |

> `h6` is styled as a small uppercase section label — commonly used for sidebar section headings and form group separators.

### Body colors
| Use | Value | Tailwind class |
|-----|-------|----------------|
| Body text | `#4a5568` | `tw-text-body` |
| Heading text | `#111827` | — |
| Muted / labels | `#9ca3af` | `tw-text-muted` |
| Table cells / form elements | `#495057` | — |

---

## Tailwind CSS

Tailwind is configured with the `tw-` prefix to prevent conflicts with Bootstrap. All Tailwind utilities are available as `tw-{utility}`, e.g. `tw-flex`, `tw-text-sm`, `tw-mb-4`.

**Config:** `tailwind.config.js` — breakpoints match Bootstrap 5 exactly.

### Breakpoints
| Name | px | Bootstrap equivalent |
|------|----|----------------------|
| `sm` | 576px | `sm` |
| `md` | 768px | `md` |
| `lg` | 992px | `lg` |
| `xl` | 1200px | `xl` |
| `2xl` | 1400px | `xxl` |

Use responsive prefixes as `md:tw-grid-cols-2`, `lg:tw-hidden`, etc.

### Semantic color classes
These map to the Tailwind `extend.colors` config and are used as `tw-text-{name}`, `tw-bg-{name}`, `tw-border-{name}`:

| Token | Hex | Usage |
|-------|-----|-------|
| `body` | `#4a5568` | Body text |
| `heading` | `#2d3748` | Heading text |
| `muted` | `#9ca3af` | Muted text, secondary labels |
| `success` | `#16a34a` | Positive states |
| `warning` | `#d97706` | Warning states |
| `danger` | `#ef4444` | Error text, destructive |
| `danger-dark` | `#dc2626` | Danger button borders |
| `info` | `#0891b2` | Info states |
| `input-bg` | `#f9fafb` | Input default background |
| `input-bg-focus` | `#ffffff` | Input focused background |
| `input-bg-hover` | `#f3f4f6` | Input hovered background |
| `surface` | `#ffffff` | Card/modal backgrounds |
| `border-subtle` | `#e5e7eb` | Subtle dividers and borders |
| `border-default` | `#dee2e6` | Default input/card borders |

### Font family classes
| Class | Font |
|-------|------|
| `tw-font-sans` | "Source Sans 3" (body) |
| `tw-font-heading` | "Inter" (headings) |

### Border radius tokens
| Class | Value | Use |
|-------|-------|-----|
| `tw-rounded-card` | `12px` | Cards |
| `tw-rounded-card-mobile` | `8px` | Cards on mobile |
| `tw-rounded-input` | `8px` | Inputs, selects |
| `tw-rounded-btn` | `8px` | Buttons |
| `tw-rounded-badge` | `12px` | Badges, chips |

### Box shadow tokens
| Class | Use |
|-------|-----|
| `tw-shadow-card` | Default card shadow |
| `tw-shadow-card-hover` | Card hover lift |
| `tw-shadow-dropdown` | Dropdowns, popovers |
| `tw-shadow-modal` | Modal overlay |
| `tw-shadow-focus-ring` | Focus ring (brand-color-aware) |

### Spacing tokens
| Class | Value | Use |
|-------|-------|-----|
| `tw-px-card-pad` / `tw-py-card-pad` | `20px` | Card body padding |
| `tw-px-card-pad-mobile` | `10px` | Card body padding on mobile |
| `tw-gap-grid-gap` | `12px` | Grid column gap |
| `tw-gap-grid-gap-mobile` | `8px` | Grid column gap on mobile |
| `tw-h-navbar-height` | `50px` | Navbar height offset |
| `tw-w-sidebar-width` | `260px` | Expanded sidebar width |
| `tw-w-sidebar-collapsed-width` | `86px` | Collapsed sidebar width |
| `tw-h-mobile-nav-height` | `72px` | Mobile bottom nav height |

### Z-index tokens
| Class | Value | Use |
|-------|-------|-----|
| `tw-z-sidebar` | 1000 | Sidebar |
| `tw-z-navbar` | 1001 | Top navbar |
| `tw-z-dropdown` | 1050 | Dropdowns |
| `tw-z-modal-bd` | 1040 | Modal backdrop |
| `tw-z-modal` | 1050 | Modal panel |
| `tw-z-mobile-nav` | 1100 | Mobile bottom nav |
| `tw-z-overlay` | 9999 | Full-screen overlays |

---

## Color Tokens

The system is **multi-brand**: all primary actions use CSS custom properties so each brand injects its own palette.

| Token | Fallback | Usage |
|-------|----------|-------|
| `--brand-color` | `#3b82f6` | Primary buttons, active states, focus rings |
| `--brand-color-text` | `#ffffff` | Text on primary button background |

### Semantic colors
Prefer the Tailwind semantic classes above (`tw-text-danger`, `tw-text-muted`, etc.) over raw hex values in new code. Raw hex is acceptable in component SCSS files where Tailwind utilities are not practical.

| Name | Hex | Tailwind class |
|------|-----|----------------|
| Body text | `#4a5568` | `tw-text-body` |
| Heading | `#2d3748` | `tw-text-heading` |
| Muted | `#9ca3af` | `tw-text-muted` |
| Success | `#16a34a` | `tw-text-success` |
| Warning | `#d97706` | `tw-text-warning` |
| Danger | `#ef4444` | `tw-text-danger` |
| Info | `#0891b2` | `tw-text-info` |
| Table cells / labels | `#495057` | — (Bootstrap convention) |

---

## Spacing & Layout

- **Card gutter:** `24px` margin-bottom (mobile) / `32px` (desktop)
- **Card padding:** `28px` header, `0 28px 28px` body (mobile: `20px`)
- **Row gutters:** `-12px` margin, `12px` padding per column (mobile: `8px`)
- **Grid:** Bootstrap 12-column, use `col-md-*`, `col-lg-*` breakpoints

---

## Cards

Defined in `src/styles/components.scss`.

```html
<div class="card">
  <div class="card-header">
    <h5>Title</h5>
  </div>
  <div class="card-body">
    ...
  </div>
</div>
```

- `border: none`, `border-radius: 12px` (mobile: `8px`)
- Box shadow: subtle `rgba(0,0,0,0.02–0.04)`
- Hover: slight lift (`translateY(-0.5px)`) + deeper shadow
- `overflow: hidden` — required for search bar panel to bleed edge-to-edge

---

## Buttons

All defined in `src/styles/components.scss` as Bootstrap overrides.

### Variants

| Class | Style | Use |
|-------|-------|-----|
| `.btn-primary` | Filled, brand color, shadow | Primary CTA |
| `.btn-secondary` | White, no border, soft shadow | Secondary / neutral actions |
| `.btn-danger` | Red border + red text, no fill | Destructive actions |
| `.btn-ghost` | Transparent, text-only | Tertiary / inline actions |
| `.btn-icon` | Transparent, no shadow | Icon-only buttons (search, close, etc.) |

### Sizes
| Modifier | Notes |
|----------|-------|
| `.btn-sm` | `font-size: 13px`, smaller icon margin. On `.btn-icon`, reduces padding to `4px` for dense contexts (tables, lists) |
| `.btn-lg` | `padding: 16px 32px`, `font-size: 15px` |

### Rules
- All buttons use `display: inline-flex; align-items: center`
- Icons inside buttons use `margin-right: 8px` (sm: `6px`)
- Hover: `translateY(-1px)` + deeper shadow
- Disabled: `opacity: 0.5`, no transform, `cursor: not-allowed`
- `.btn-icon` **always** overrides to `background: transparent !important; box-shadow: none !important`
- If a fixed-square icon button is ever needed, add a `.btn-icon--square` modifier on top of `.btn-icon` rather than a new standalone class

### Kebab Menu

Reusable three-dot overflow menu. Defined in `src/styles/components.scss`.

| Class | Purpose |
|-------|---------|
| `.kebab-container` | Wrapper — `position: relative; display: inline-block` |
| `.kebab-btn` | Toggle button — transparent, gray icon, hover highlight |
| `.kebab-dropdown` | Dropdown panel — `position: fixed`, `z-index: 1050`, rounded, shadowed |

The dropdown uses **fixed positioning** with JS-calculated `top`/`right` coordinates so it is never clipped by `overflow: hidden` on ancestor containers. Render it **outside** the scrollable parent (e.g. after the table).

Dropdown items use `.btn .btn-ghost` for consistent styling:
```html
<div class="kebab-dropdown" *ngIf="isOpen" [style.top.px]="pos.top" [style.right.px]="pos.right">
  <button class="btn btn-ghost" (click)="edit()"><i class="fa fa-edit me-2"></i> Edit</button>
  <button class="btn btn-ghost text-danger" (click)="delete()"><i class="fa fa-trash me-2"></i> Delete</button>
</div>
```

Positioning pattern (TypeScript):
```typescript
const btn = (event.target as HTMLElement).closest('.kebab-btn') as HTMLElement;
const rect = btn.getBoundingClientRect();
this.dropdownPosition = {
  top: rect.bottom + 2,
  right: document.documentElement.clientWidth - rect.right
};
```

Close on document click (`@HostListener('document:click')`) and on scroll (`document.addEventListener('scroll', handler, true)`).

### Blob accent (`.btn-primary` only)
Primary buttons carry two decorative circular blobs via `::before` / `::after` — the same visual language used by primary quick-link cards and the Current Balance section.

| Pseudo | Size | Position | Opacity |
|--------|------|----------|---------|
| `::before` | 70 × 70 px | `top: -25px; right: -15px` | `rgba(255,255,255,0.10)` |
| `::after` | 40 × 40 px | `bottom: -12px; left: 12px` | `rgba(255,255,255,0.07)` |

The button uses `position: relative; overflow: hidden` to clip the blobs. Both pseudo-elements have `pointer-events: none` so they never block clicks.

---

## Floating Action Bar (`<app-floating-action-bar>`)

**Location:** `src/app/components/shared/floating-action-bar/`

Replaces `.sticky-bottom-panel`. A standalone Angular component that renders a sticky frosted-glass bar fixed to the bottom of the scroll area.

### Content slots

| Slot | How to target | Visible |
|------|--------------|---------|
| Left | `floatingStart` attribute | Desktop (≥992px) — use `d-none d-lg-flex` on the child |
| Mobile bar info | `floatingBarInfo` attribute | ≤991px — always visible in the bar row even when drawer is closed; use for compact totals/counts |
| Secondary | default slot (any child without `fab-primary-btn`) | Both — inline on desktop; collapses into drawer on mobile |
| Primary | `class="... fab-primary-btn"` | Both — always visible |

### `variant` input

| Value | Behaviour |
|-------|-----------|
| `'drawer'` (default) | On mobile, secondary buttons collapse into a pull-tab slide-up drawer |
| `'strip'` | All buttons always visible, stacked in a column on mobile. Desktop layout is unchanged. Use when the action bar contains multiple equally-important actions that must all remain visible (e.g. the email send screen). |

```html
<app-floating-action-bar variant="strip">
  <button class="btn btn-secondary" (click)="preview()">Send Test Email</button>
  <button class="btn btn-primary fab-primary-btn" (click)="send()">Send Email</button>
</app-floating-action-bar>
```

### Drawer behaviour (mobile ≤768px)

| Condition | Mobile behaviour |
|-----------|-----------------|
| `variant="drawer"` (default), `.fab-primary-btn` present **and** default slot has children | Drawer mode — secondary content collapses into a slide-up drawer with a tab caret toggle |
| `variant="drawer"`, only `.fab-primary-btn` (no secondary) | Single primary button, no toggle |
| `variant="drawer"`, only default slot (no `.fab-primary-btn`) | All content stacks vertically |
| `variant="strip"` | All buttons stacked full-width, no drawer, no toggle. `floatingStart` content shown above the buttons. |

Drawer mode is **auto-detected** via `MutationObserver` on projected content. `variant="strip"` suppresses drawer mode regardless of slot content.

### Usage examples

**Single primary button:**
```html
<app-floating-action-bar>
  <button class="btn btn-primary fab-primary-btn" (click)="save()">Save Changes</button>
</app-floating-action-bar>
```

**Drawer — secondary + primary:**
```html
<app-floating-action-bar>
  <button class="btn btn-secondary" (click)="cancel()">Cancel</button>
  <button class="btn btn-secondary" (click)="saveDraft()">Save as Draft</button>
  <button class="btn btn-primary fab-primary-btn" (click)="publish()">Publish</button>
</app-floating-action-bar>
```

**Desktop summary + mobile bar info:**
```html
<app-floating-action-bar>
  <!-- Desktop left: full detail -->
  <div floatingStart class="d-none d-lg-flex align-items-center gap-3">
    <strong>Total: {{ formatCurrency(total) }}</strong>
    <span class="text-muted">{{ count }} rows</span>
  </div>
  <!-- Mobile bar: compact summary always visible next to primary button -->
  <span floatingBarInfo class="text-muted">{{ formatCurrency(total) }} · {{ count }} rows</span>
  <button class="btn btn-secondary" (click)="cancel()">Cancel</button>
  <button class="btn btn-primary fab-primary-btn" (click)="save()">Save</button>
</app-floating-action-bar>
```

**Conditional buttons — apply `*ngIf` directly to each button:**
```html
<app-floating-action-bar>
  <button class="btn btn-secondary" *ngIf="isDraft" (click)="saveDraft()">Save as Draft</button>
  <button class="btn btn-primary fab-primary-btn" *ngIf="isDraft" (click)="publish()">Publish</button>
  <button class="btn btn-primary fab-primary-btn" *ngIf="isPublished" (click)="save()">Save Changes</button>
</app-floating-action-bar>
```

### Rules

- **Never wrap projected buttons in `<ng-container *ngIf>`** — the wrapper becomes the direct child and breaks slot matching. Apply `*ngIf` directly to each `<button>`.
- Absolutely-positioned popup menus (e.g. Bootstrap dropdowns) are clipped by the drawer's `overflow: hidden`. Use flat buttons inside the drawer for mobile; put the dropdown in `d-none d-lg-flex` for desktop only.
- Bar is offset `72px` upward on ≤991px to clear the fixed mobile workspace navigator.
- The `[floatingBarInfo]` slot shows at ≤991px (Bootstrap `lg`). Always pair it with a `[floatingStart]` child using `d-none d-lg-flex`.
- Import `FloatingActionBarComponent` in the consumer's `imports` array.

---

## Forms

Use `tw-input` / `tw-label` for all new form fields. The older `form-control` / `form-label` Bootstrap classes still work but should not be used in new code.

### `tw-label`
Defined in `src/styles.scss`. Applied to `<label>` elements.
- `display: block`, `margin-bottom: 6px`
- `font-size: 0.875rem (14px)`, `font-weight: 500`, `color: #374151`

```html
<label for="title" class="tw-label">Title <span class="tw-text-danger">*</span></label>
```

### `tw-input`
Defined in `src/styles.scss`. Applied to `<input>`, `<select>`, `<textarea>`.
- Background: `#f9fafb` (rest) → `#f3f4f6` (hover) → `#ffffff` (focus)
- Border: `1px solid` brand-color-tinted (`color-mix(brand 15%, #e5e7eb)`)
- Focus: border becomes `--brand-color`, focus ring `0 0 0 3px brand 15%`
- `border-radius: 8px`, `padding: 10px 14px`, `width: 100%`
- Invalid state: `border-color: #FCA5A5`, no focus ring

```html
<input type="text" class="tw-input" id="title" [(ngModel)]="value" placeholder="...">
<select class="tw-input" [(ngModel)]="selected">...</select>
<textarea class="tw-input" rows="3" [(ngModel)]="text"></textarea>
```

### `tw-input-sm`
Compact variant — `padding: 6px 10px`, `font-size: 0.75rem`. Replaces `form-control-sm`.

### `tw-input-lg`
Large variant — `padding: 10px 16px`, `font-size: 1rem`. Replaces `form-control-lg`.

### `.form-group` (legacy Bootstrap)
- `margin-bottom: 20px`

### `.form-actions`
- `text-align: right` (mobile: center, button full-width up to 300px)
- `border-top: 1px solid #e5e7eb`, `margin-top: 32px`

---

## Tables

### Global table styles (`src/styles.scss`)

- `thead th`: transparent background, color `#9ca3af`, `font-weight: 400`, no text-transform
- `tbody td`: `padding: 15px`, `color: #495057`, **no borders**
- Row hover: `background-color: #f8f9fa`
- Font size: `14px` on table, overridden to `13px` globally

### Two modes (controlled by `responsiveMode` input on `PaginatedTableComponent`)

| Mode | Class | Mobile behavior |
|------|-------|-----------------|
| `card` | `.table` | Converts rows into stacked cards at `≤576px` |
| `financial` | `.table-financial` | Stays tabular, hides/narrows columns using utility classes |

#### Financial table mobile utility classes
- `.mobile-hide` — hidden on `≤576px`
- `.mobile-narrow` — constrained width
- `.mobile-number` — right-aligned, no-wrap, bold
- `.mobile-text` — wrappable text cell
- `.tablet-hide` / `.tablet-narrow` — same for `≤768px`

### Status Badge (pill) — preferred

```html
<span class="status-badge status-success">Succeeded</span>
```

The standard status indicator. A rounded pill with a soft tinted background and matching colored text. Use this for all new status displays and when updating existing ones. Defined in `src/styles/components.scss`.

| Modifier | Text color | Background | Use |
|----------|------------|------------|-----|
| `status-success`   | green `#16a34a`  | green 12% tint  | Succeeded, Live, Paid, Accepted |
| `status-warning`   | amber `#d97706`  | amber 12% tint  | Pending, Draft, Awaiting |
| `status-danger`    | red `#dc2626`    | red 12% tint    | Failed, Taken Down |
| `status-secondary` | gray `#6b7280`   | gray 12% tint   | Canceled, Refunded, Unknown |
| `status-info`      | cyan `#0891b2`   | cyan 12% tint   | For Submission, Informational |

Style: `font-size: 11px` (mobile) / `13px` (≥768px), `padding: 3px 9px` (mobile) / `5px 11px` (≥768px), `border-radius: 999px`, `font-weight: 500`. Include a Font Awesome `<i>` icon before the label text — the badge styles it to `10px`. Choose an icon appropriate to the semantic:

The icon is injected automatically via the CSS `::before` pseudo-element — **no icon markup is needed in the HTML**. Each variant has its own Feather icon baked in as an SVG data URI in `components.scss`:

| Variant | Icon |
|---------|------|
| `status-success`   | `check-circle` (green) |
| `status-danger`    | `x-circle` (red) |
| `status-warning`   | `clock` (amber) |
| `status-secondary` | `minus-circle` (gray) |
| `status-info`      | `info` (cyan) |

```html
<!-- No icon markup needed — just the span + class -->
<span class="status-badge status-success">Succeeded</span>
<span class="status-badge status-danger">Failed</span>
<span class="status-badge status-warning">Pending</span>
```

> **Why CSS, not inline SVG?** Angular's `[innerHTML]` sanitizer strips SVG elements from formatter output. The `::before` + SVG data URI approach works in all contexts.

### Status Dot (legacy)

```html
<span class="status-dot status-success">Active</span>
```
A small colored circle (`9px`) beside colored text. Defined in `src/styles/components.scss`. **Prefer `.status-badge` for new code.** The status dot variants share the same modifier names as the badge (see table above).

---

## `PaginatedTableComponent`

The primary data display component. Selector: `app-paginated-table`.

### Key inputs

| Input | Type | Purpose |
|-------|------|---------|
| `title` | `string` | Card header title |
| `data` | `any[]` | Row data |
| `columns` | `TableColumn[]` | Column definitions |
| `pagination` | `PaginationInfo` | Pagination metadata |
| `loading` | `boolean` | Show loading dots |
| `actions` | `TableAction[]` | Per-row kebab menu items |
| `headerActions` | `HeaderAction[]` | Buttons in card header |
| `showSearch` | `boolean` | Toggle search icon |
| `showSortableHeaders` | `boolean` | Render `<thead>` with sort |
| `responsiveMode` | `'card' \| 'financial'` | Mobile layout strategy |
| `enableBulkOperations` | `boolean` | Checkbox + bulk action row |
| `rowClassGetter` | `(item) => string` | Dynamic row CSS class |

### `TableColumn` options
- `key`, `label` — required
- `type`: `'text' | 'number' | 'date' | 'select'`
- `formatter(item)` — custom render function
- `renderHtml: true` — render formatter output as innerHTML (for badges, HTML strings). **⚠️ Angular's `[innerHTML]` sanitizer strips inline `style` attributes** — never use `style="background:..."` in formatter output. Use CSS classes instead (see Avatar chip below).

- `sortable: true` — clickable header with sort icon
- `align`: `'left' | 'center' | 'right'`
- `cardHeader: true` — first cell becomes card title on mobile
- `hideDataLabel: true` — suppress `data-label` prefix on mobile
- `mobileClass` / `tabletClass` — CSS class strings for responsive hiding
- `showBreakdownButton: true` — adds a pie chart icon button to the cell, emits `breakdownButtonClick`
- `mergeCell: true` — marks this column as a **mobile-only section-header trigger**. The column is hidden from `<thead>` and normal data cells. When `item[key]` is truthy, that row renders as a single full-width cell (`.merged-cell`) visible only at ≤576 px. Rows where the value is falsy render normally.
- `mobileGroup: string` — group identifier for **mobile column merging**. Columns sharing the same `mobileGroup` value collapse on mobile: non-main columns' `<th>` and `<td>` are hidden (`.mobile-group-hidden`), and their values are rendered as secondary lines inside the main column's cell.
- `mobileGroupMain: true` — designates this column as the primary column of its `mobileGroup`. Its label appears in the column header on all screen sizes. Secondary values from other group members are injected above (before) or below (after) the main value based on their position in the `columns` array. Secondary values that have `renderHtml: true` are rendered with `[innerHTML]`.

> **Mobile column merging example** — payments table merges date, description, and status; amount stays separate:
> ```typescript
> columns = [
>   { key: 'date',        label: 'Date',        type: 'date',   mobileGroup: 'summary' },
>   { key: 'description', label: 'Description', type: 'text',   mobileGroup: 'summary', mobileGroupMain: true },
>   { key: 'amount',      label: 'Amount',       type: 'number', align: 'right' },
>   { key: 'status',      label: 'Status',                       mobileGroup: 'summary', renderHtml: true,
>     formatter: (item) => `<span class="status-dot ...">${item.status}</span>` },
> ];
> // Mobile cell for "description" column renders:
> //   Jan 1, 2024          ← date (secondary, before)
> //   Streaming royalties  ← description (main)
> //   ● Succeeded          ← status HTML (secondary, after)
> ```

### Avatar chip in table cells

Use the `.avatar-chip` / `.avatar-chip__circle.ac-N` CSS classes (defined globally in `styles.scss`) to show an avatar circle with initials inside a `renderHtml` formatter. **Do not use inline styles** — they are stripped by Angular's `[innerHTML]` sanitizer.

Color index classes: `.ac-0` indigo · `.ac-1` violet · `.ac-2` pink · `.ac-3` amber · `.ac-4` emerald · `.ac-5` blue · `.ac-6` teal · `.ac-7` orange. Use `.avatar-chip__circle--anon` for unknown users.

```typescript
// In the component:
getAvatarColorIndex(name: string): number {
  if (!name) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 8;
}
getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// Column definition:
{ key: 'name', label: 'Name', renderHtml: true, formatter: (item) => {
  const idx = this.getAvatarColorIndex(item.name);
  const initials = this.getInitials(item.name);
  return `<span class="avatar-chip"><span class="avatar-chip__circle ac-${idx}">${initials}</span>${item.name}</span>`;
}}
```

For mobile card templates, use `getAvatarColor(name)` (returns the hex string) with `[style.background-color]` on a plain `<div>`, since that binding is not sanitized.

> **Section-header row example** — inject labelled dividers into the data array:
> ```typescript
> columns = [
>   { key: 'sectionLabel', label: '', mergeCell: true },
>   { key: 'date',         label: 'Date',   type: 'date' },
>   { key: 'description',  label: 'Description' },
>   { key: 'amount',       label: 'Amount', type: 'number' },
> ];
> data = [
>   { sectionLabel: 'Album Royalties' },
>   { date: '2024-01-01', description: 'Streaming', amount: 1000 },
>   { sectionLabel: 'Live Events' },
>   { date: '2024-02-01', description: 'Concert', amount: 2500 },
> ];
> ```

### `HeaderAction` dynamic properties
Both `icon`, `label`, and `title` accept either a plain string or a `() => string` function — useful for toggling spinner icons or changing button text during loading states.

### Content slots (ng-template)

| Name | Purpose |
|------|---------|
| `#tableContent` | Full custom table body (when not using `showSortableHeaders`) |
| `#actionsContent` | Custom kebab dropdown content |
| `#customButtons` | Extra controls always visible in header (e.g., filter dropdowns) |
| `#bulkOperationsContent` | Bulk action buttons in the selection banner |

### Kebab menu
- Rendered **outside the card** as `position: fixed` to avoid `overflow: hidden` clipping
- Also used for mobile header actions (bento grid icon at `<576px`)

---

## Date Range Filter (`DateRangeFilterComponent`)

Selector: `app-date-range-filter`.

- Collapsible card with a ghost button toggle
- Presets: Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, All Time
- Custom date range via two date inputs
- `compact` input: reduces padding, hides some labels
- `showComparison` / `showExport` inputs: opt-in features
- Refresh button emits `refresh` output, shows `fa-spin` while `loading`

---

## Loading States

Three built-in patterns defined in `src/styles.scss`:

| Class | Use |
|-------|-----|
| `.loading-dots` | Three-dot animated indicator — used inside `PaginatedTableComponent` |
| `.loading-overlay` | Full-screen fixed overlay with blur backdrop |
| `.loading-overlay-relative` | Absolute overlay scoped to a positioned container |
| `.loading-spinner` | Inline 16px spinning border |
| `.loading-inline` | `display: inline-flex` wrapper for spinner + text |

---

## Modal Behavior

Modals must escape the `.wrapper` / `.main-panel` positioning context to display correctly:

- Bootstrap modals: use `data-bs-container="body"` or ensure they append to `<body>`
- Custom modals (e.g., lightbox): move to `document.body` via JS on open
- Global CSS forces `.modal` to `position: fixed !important` with full viewport coverage

---

## Icons

Icons are rendered via the `<app-icon>` component (selector: `app-icon`). It renders an inline SVG from the icon registry.

### Basic usage

```html
<!-- Icon next to text — default, has right margin -->
<app-icon name="upload" class="tw-mr-1" /> Upload Document

<!-- Standalone icon — no sibling text -->
<app-icon name="x" iconOnly />
```

### `iconOnly` flag

**Always add `iconOnly` when the icon has no visible text sibling in the same element.**

The component applies `margin-right: 0.3em` by default so icons sit flush before text. `iconOnly` removes that trailing margin when there is no text following.

**Use `iconOnly` when the icon is:**
- The sole content of a button (`btn-icon`, `kebab-btn`, etc.)
- A standalone decorative or status icon (check, warning, spinner, chevron toggle, etc.)
- Inside a layout slot with no adjacent text node

**Do NOT use `iconOnly` when the icon is:**
- Immediately followed by text in the same parent (`<app-icon name="plus" class="tw-mr-1" /> Add Item`)
- Inside a heading or paragraph alongside text

```html
<!-- ✅ Correct -->
<button class="btn-icon"><app-icon name="search" iconOnly /></button>
<app-icon name="check" class="tw-text-success" iconOnly *ngIf="saved" />
<app-icon name="chevron-down" iconOnly />

<!-- ❌ Wrong — iconOnly on an icon that precedes text -->
<app-icon name="plus" iconOnly /> Add Item

<!-- ❌ Wrong — missing iconOnly on a standalone icon -->
<button class="btn-icon"><app-icon name="x" /></button>
```

### Available icons

Icons are registered in `icon.registry.ts`. Common names used across the app:

- `more-vertical` — kebab/row actions
- `search` — search toggle
- `filter-x` — clear filters
- `x` — close/dismiss
- `sort` / `sort-asc` / `sort-desc` — sortable column headers
- `refresh` / `spinner` (+ `tw-animate-spin`) — refresh / loading
- `chart-pie` — breakdown button
- `check`, `check-circle` — success/confirmed state
- `warning` — alert/warning state
- `eye` / `eye-off` — show/hide toggle
- `upload`, `download` — file actions
- `trash` — delete
- `plus` — add/create
- `bell` — notification bell (registered as a Feather-style inline SVG path)

> **Notification bell:** Always render the notification bell in `NotificationBellComponent` using `<app-icon name="bell" iconOnly />` (inline SVG via the icon registry). Do **not** use a Font Awesome `fa-bell` class for this component. The `bell` icon is registered in `icon.registry.ts` as a Feather-style inline SVG path.
- `edit` / `save` — edit actions
- `folder` — file/document context
- `calendar` — date picker
- `chevron-down` / `chevron-up` — collapse/expand toggles

---

## Sidebar & Layout Shell

Based on **Light Bootstrap Dashboard** theme (`assets/css/light-bootstrap-dashboard.css`).

- Sidebar nav: uppercase text-transform **overridden** to `none` via global CSS
- Mobile: sidebar slides in from the right; `html.nav-open` shifts `.main-panel` by `-260px`
- Desktop (`≥992px`): sidebar always visible, transforms locked off

### Mobile bottom nav
When a mobile workspace navigation bar is present, `:root.has-mobile-nav` is set and content gets `padding-bottom: 70px`. Sticky/floating elements also offset by `70px`.

### Sidebar Submenus & Page Tabs

Many screens are structured as a **parent sidebar item** with **child routes** that each swap the page's content panel. Some screens additionally use an **in-page section navigator** to switch between sub-sections without a route change — the two mechanisms can coexist.

#### Expanded sidebar — inline accordion

A `MenuItem` with a `children` array renders a `.parent-menu-item` anchor and a hidden `<ul class="submenu">` below it. Clicking the parent calls `toggleSubmenu()`, which adds/removes the route from `expandedMenus` and applies the `.expanded` class. The submenu animates open via `max-height: 0 → 400px` (transition `0.3s ease`).

The submenu **auto-expands** whenever a child route is active (`isActiveParentRoute` check inside `isSubmenuExpanded`). If the user explicitly collapses it, the route is stored in `collapsedMenus` so it stays closed even with an active child. A chevron arrow (`.submenu-arrow`) rotates 180° when open.

Child links (`.submenu-item`) are styled at 12 px, indented 54 px, with a 1 px vertical track line drawn by `li::before` at `left: 31px`.

The `MenuItem` tree supports arbitrary nesting — the same rendering template handles all levels.

#### Collapsed desktop sidebar — flyout panel

When the sidebar is in its 86 px icon-only state, clicking a parent item shows a `.flyout-panel` instead of an inline accordion. The flyout is a `position: fixed` panel, 220 px wide, that slides in from `left: 86px` using a `slideIn` keyframe animation. A transparent `.flyout-backdrop` covering the rest of the viewport closes it on click-outside.

#### Sidebar-driven page tabs

When a parent item has child routes, each child route maps to a section of the page template. The page component resolves the active section from the last URL segment and shows the correct content via `*ngIf="activeTab === '...'"`. Tab components live in `src/app/pages/<feature>/components/`.

#### In-page section navigator

For screens that contain multiple logically distinct sections within a single route, a vertical section navigator is rendered alongside the content area. This is an optional pattern used when it makes sense to subdivide a screen without adding sidebar entries or new routes.

**Implementation:** Use the `InPageNavComponent` (`app-in-page-nav`) located at `src/app/components/shared/in-page-nav/`. Do not re-implement the layout manually.

```typescript
import { InPageNavComponent, InPageNavTab } from '../../components/shared/in-page-nav/in-page-nav.component';

// In the component class:
navTabs: InPageNavTab[] = [
  { id: 'section-a', label: 'Section A', icon: 'fas fa-icon-name' },
  { id: 'section-b', label: 'Section B', icon: 'fas fa-icon-name' },
];
activeSection = 'section-a';

onNavTabChange(id: string): void {
  this.activeSection = id;
}
```

```html
<app-in-page-nav [tabs]="navTabs" [activeTab]="activeSection" (tabChange)="onNavTabChange($event)">
  <div *ngIf="activeSection === 'section-a'">...</div>
  <div *ngIf="activeSection === 'section-b'">...</div>
</app-in-page-nav>
```

**Component inputs/outputs:**
| Property | Type | Description |
|----------|------|-------------|
| `tabs` | `InPageNavTab[]` | Array of tab definition objects |
| `activeTab` | `string` | ID of the currently active tab |
| `tabChange` | `EventEmitter<string>` | Emits the tab ID when the user clicks a tab |

**Responsive behaviour:**
- **Desktop (>1024 px):** vertical sidebar, 200 px wide, sticky, `border-left: 3px` active indicator
- **Tablet (≤1024 px):** horizontal scrollable tab bar at the top, `border-bottom: 3px` active indicator
- **Mobile (≤768 px):** tabs fill the full width equally (`flex: 1` per tab)
- **Stack mode (>2 tabs, mobile):** when the `tabs` array has more than 2 entries, the component automatically switches each tab button to a column layout (icon stacked above label, 10 px label text) to conserve horizontal space

**Tab definition (`InPageNavTab`):**
```typescript
export interface InPageNavTab {
  id: string;      // unique identifier matched against activeTab
  label: string;   // display text
  icon: string;    // full Font Awesome class string, e.g. 'fas fa-scale-balanced'
  // Optional:
  disabled?: boolean;                             // greys out the tab, prevents clicks
  status?: 'completed' | 'warning' | 'error' | null; // trailing status icon (green/yellow/red)
  color?: 'danger';                               // renders the tab in red (e.g. a Cancel action)
  tooltip?: string;                               // hover tooltip; supports \n for multi-line
}
```

**Status icons** appear as a small trailing icon inside the tab button:
- `'completed'` → green check circle (`fa-check-circle`)
- `'warning'` → yellow warning triangle (`fa-exclamation-triangle`)
- `'error'` → red error circle (`fa-exclamation-circle`)
- `null` / `undefined` → no icon

On mobile (stack mode) the status icon is repositioned as an absolute badge in the top-right corner of the button.

**Danger-colored tabs** (`color: 'danger'`) are rendered in red and separated from regular tabs by a margin/border. They should be used for destructive or exit actions (e.g. Cancel). To handle a danger tab's click differently from regular navigation, check the emitted ID in `tabChange`:
```typescript
onNavTabChange(id: string): void {
  if (id === 'cancel') { this.onCancelEditMode(); return; }
  this.setActiveSection(id as MySection);
}
```

**Dynamic tabs (conditional items):** If tabs need to appear/disappear based on runtime state, use a getter instead of a plain array:
```typescript
get navTabs(): InPageNavTab[] {
  const tabs = [ /* base tabs */ ];
  if (this.someCondition) tabs.push({ id: 'extra', label: 'Extra', icon: 'fas fa-plus' });
  return tabs;
}
```

**Current usages:** `recuperable-expense-tab` (Balance / Expense Flow), `users-tab` (Users / Login Attempts), `event-form` (Details / Pricing / Buy Page / Scanner), `release-submission` (Release Info / Album Credits / Track List / Submit / Cancel — uses status icons, disabled tabs, tooltip, and danger color).

#### Workspace contexts

The sidebar is workspace-aware via `WorkspaceService`. The four workspaces are `music`, `campaigns`, `labels`, and `admin`. Switching workspace filters `visibleSections` in `SidebarComponent` so only the relevant parent items are shown — each workspace surfaces its own submenu children as top-level entries, making the nav feel flat within that context. The selected workspace is persisted to `localStorage`.

---

## Key File Locations

| File | Purpose |
|------|---------|
| `src/styles.scss` | Global resets, table styles, loading states, modal fixes, typography |
| `src/styles/components.scss` | Cards, buttons, forms, grid overrides, sticky bottom panel |
| `src/app/components/shared/paginated-table/` | Main data table component |
| `src/app/components/shared/date-range-filter/` | Date range filter component |
| `src/app/components/shared/floating-action-bar/` | Sticky bottom action bar |
| `src/app/components/shared/in-page-nav/` | In-page section navigator (vertical sidebar on desktop, horizontal tabs on mobile) |
| `src/app/components/shared/confirmation-dialog/` | Reusable confirm dialog |
| `src/app/components/shared/lightbox/` | Image lightbox (moves to body to escape positioning context) |
| `src/app/components/shared/audio-player-popup/` | Audio playback overlay |
| `src/app/components/shared/app-notification-banner/` | App-wide notification banner |
| `src/app/material-theme.scss` | Angular Material theme (used for tooltips) |
