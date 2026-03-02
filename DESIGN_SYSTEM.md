# Label Dashboard Design System

This document describes the design system conventions used in the Angular frontend (`src_new/label-dashboard-web/`). Follow these patterns for all new UI work.

---

## Typography

### Fonts
- **Body:** `"Source Sans 3"`, fallback `-apple-system, BlinkMacSystemFont, "Segoe UI"` — loaded via `index.html`
- **Headings:** `"Plus Jakarta Sans"`, fallback `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI"`
- **Base size:** `13px` on `html` and `body` (reduced from browser default)

### Scale
| Tag | Size | Weight | Letter-spacing |
|-----|------|--------|---------------|
| `h1` | 1.8rem | 700 | -0.035em |
| `h2` | 1.6rem | 700 | -0.03em |
| `h3` | 1.4rem | 600 | -0.025em |
| `h4` | 1.2rem | 600 | — |
| `h5` | 1.1rem | 600 | — |
| `h6` | 1.0rem | 500 | — |

Card titles (`.card-header h5`) render at `20px / 500` weight with `letter-spacing: -0.025em`.

### Body colors
| Use | Value |
|-----|-------|
| Body text | `#4a5568` |
| Heading text | `#2d3748` |
| Muted / labels | `#9ca3af` |
| Table cells | `#495057` |

---

## Color Tokens

The system is **multi-brand**: all primary actions use CSS custom properties so each brand injects its own palette.

| Token | Fallback | Usage |
|-------|----------|-------|
| `--brand-color` | `#3b82f6` | Primary buttons, active states, focus rings |
| `--brand-color-text` | `#ffffff` | Text on primary button background |

### Semantic colors (hardcoded)
| Name | Hex | Usage |
|------|-----|-------|
| Success | `#28a745` | Positive balance, badge-success |
| Warning | `#ffc107` | Warning badges |
| Danger | `#ef4444` / `#dc2626` | Danger buttons, error text, negative amounts |
| Info | `#17a2b8` | Info badges |
| Secondary | `#6c757d` | Muted text, secondary badges |

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
| `.btn-sm` | `font-size: 13px`, smaller icon margin |
| `.btn-lg` | `padding: 16px 32px`, `font-size: 15px` |

### Rules
- All buttons use `display: inline-flex; align-items: center`
- Icons inside buttons use `margin-right: 8px` (sm: `6px`)
- Hover: `translateY(-1px)` + deeper shadow
- Disabled: `opacity: 0.5`, no transform, `cursor: not-allowed`
- `.btn-icon` **always** overrides to `background: transparent !important; box-shadow: none !important`
- If a fixed-square icon button is ever needed, add a `.btn-icon--square` modifier on top of `.btn-icon` rather than a new standalone class

### Blob accent (`.btn-primary` only)
Primary buttons carry two decorative circular blobs via `::before` / `::after` — the same visual language used by primary quick-link cards and the Current Balance section.

| Pseudo | Size | Position | Opacity |
|--------|------|----------|---------|
| `::before` | 70 × 70 px | `top: -25px; right: -15px` | `rgba(255,255,255,0.10)` |
| `::after` | 40 × 40 px | `bottom: -12px; left: 12px` | `rgba(255,255,255,0.07)` |

The button uses `position: relative; overflow: hidden` to clip the blobs. Both pseudo-elements have `pointer-events: none` so they never block clicks.

### `.sticky-bottom-panel`
A sticky save/submit panel used on long forms. Sits at the bottom of its scroll container with a frosted-glass backdrop. Contains `.panel-content` which flex-end aligns the action button.

---

## Forms

### `.form-group`
- `margin-bottom: 20px`
- `label`: 12px, weight 500, color `#374151`

### `.form-control`
- Background: `#f9fafb` (rest), `#ffffff` (focus), `#f3f4f6` (hover)
- Border: **none** — uses background color change to signal state
- Focus ring: `box-shadow: 0 0 0 3px rgba(59,130,246,0.1)`
- Padding: `12px 16px`, `border-radius: 8px`
- Font size: `13px` (global override)

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

### Badges (in tables)

```html
<span class="badge badge-success">Active</span>
```
Pill shape: `border-radius: 12px`, `padding: 6px 10px`, `font-size: 11px`, uppercase.

Available: `badge-success`, `badge-warning`, `badge-danger`, `badge-secondary`, `badge-primary`, `badge-info`.

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
- `renderHtml: true` — render formatter output as innerHTML (for badges, HTML strings)
- `sortable: true` — clickable header with sort icon
- `align`: `'left' | 'center' | 'right'`
- `cardHeader: true` — first cell becomes card title on mobile
- `hideDataLabel: true` — suppress `data-label` prefix on mobile
- `mobileClass` / `tabletClass` — CSS class strings for responsive hiding
- `showBreakdownButton: true` — adds a pie chart icon button to the cell, emits `breakdownButtonClick`

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

Font Awesome Free (v6) — imported globally via `styles.scss`.

Common patterns:
- `fas fa-ellipsis-v` — kebab/row actions
- `fas fa-th` — mobile bento actions
- `fa fa-search` — search toggle
- `fa fa-filter-circle-xmark` — clear filters
- `fa fa-times` — close/dismiss
- `fa fa-sort` / `fa-sort-up` / `fa-sort-down` — sortable columns
- `fas fa-sync` (+ `fa-spin`) — refresh / loading
- `fas fa-chart-pie` — breakdown button

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

When a parent item has child routes, each child route maps to a section of the page template. The page component resolves the active section from the last URL segment and shows the correct content via `*ngIf="activeTab === '...'"`. Tab components live in `src/app/components/<domain>/`.

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
| `src/app/components/shared/in-page-nav/` | In-page section navigator (vertical sidebar on desktop, horizontal tabs on mobile) |
| `src/app/components/shared/confirmation-dialog/` | Reusable confirm dialog |
| `src/app/components/shared/lightbox/` | Image lightbox (moves to body to escape positioning context) |
| `src/app/components/shared/audio-player-popup/` | Audio playback overlay |
| `src/app/components/shared/app-notification-banner/` | App-wide notification banner |
| `src/app/material-theme.scss` | Angular Material theme (used for tooltips) |
