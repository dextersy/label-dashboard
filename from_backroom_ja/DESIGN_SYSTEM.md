# BackroomJam Design System — Font & Button Reference

Use this file as context when recreating the BackroomJam font and button structure in another app.

---

## Global Font Setup

**Font stack (set on `html, body`):**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

Inter is the only external font. No Google Fonts import exists in `index.html` — Inter must be added via a `<link>` tag or `@font-face` in the target project.

**Monospace font (Tailwind default):**
Used for timestamps and time-sensitive DAW displays via `font-mono`.

---

## Typography Scale

All sizes use Tailwind utility classes. The app uses the full scale from `text-xs` up to `text-6xl`, plus two custom sizes for ultra-compact DAW controls.

| Class | Size | Weight(s) used | Typical use |
|---|---|---|---|
| `text-[9px]` | 9px | `font-mono` | DAW time indicators, tiny initials |
| `text-[10px]` | 10px | `font-medium`, `font-bold` | Track control labels, compact metadata |
| `text-xs` | 12px | `font-medium`, `font-semibold` | Labels, badges, comments, chips |
| `text-sm` | 14px | `font-medium`, `font-semibold` | Form labels, secondary UI, button text |
| `text-base` | 16px | `font-semibold` | Large hero buttons |
| `text-lg` | 18px | `font-semibold`, `font-bold` | Card titles, modal headings |
| `text-xl` | 20px | `font-bold` | Modal titles, page sub-headings |
| `text-2xl` | 24px | `font-bold` | Dashboard section headings |
| `text-3xl` | 30px | `font-bold` | Auth page H1 |
| `text-4xl` | 36px | `font-extrabold` | Section headings |
| `text-5xl` | 48px | `font-extrabold` | Hero headline |
| `text-6xl` | 60px | — | Large emoji/icon placeholders |

---

## Font Weights

| Class | Weight | Use |
|---|---|---|
| `font-normal` | 400 | Body copy |
| `font-medium` | 500 | Buttons, labels, secondary text |
| `font-semibold` | 600 | Headings, button text, emphasis |
| `font-bold` | 700 | H1–H3, important labels |
| `font-extrabold` | 800 | Hero and large section headings |

---

## Heading Patterns

The app doesn't use semantic `<h1>`–`<h4>` tags exclusively — most headings are `<p>` or `<span>` styled via Tailwind. But there are consistent patterns:

**H1 — Page title:**
```html
<!-- Auth pages -->
<h1 class="text-3xl font-bold text-center">Sign In</h1>

<!-- Hero -->
<h1 class="text-5xl font-extrabold leading-tight">Spark music together.</h1>
```

**H2 — Section heading:**
```html
<h2 class="text-4xl font-extrabold">Your Projects</h2>
<h2 class="text-2xl font-bold">Recent Activity</h2>
```

**H3 — Card/modal title:**
```html
<h3 class="text-xl font-bold mb-5">Invite Collaborator</h3>
<h3 class="text-lg font-semibold mb-1.5 truncate">Project Name</h3>
```

**Section label (uppercase, spaced):**
```html
<p class="text-xs font-semibold uppercase tracking-wider">Collaborators</p>
```

---

## Text Utilities

**Truncation (used heavily on project/track names):**
```html
<p class="truncate">Long project name that gets cut off</p>
```

**Word breaking (used on user content — comments, bios):**
```html
<p class="break-words">User-entered content...</p>
```

**Preserve line breaks (bio/description display):**
```html
<p class="whitespace-pre-line">{{ user.bio }}</p>
```

**Line height:**
- `leading-none` — DAW compact rows
- `leading-tight` — Hero text
- `leading-snug` — Medium density
- `leading-relaxed` — Body/description text

**Letter spacing:**
- `tracking-wider` — Used only with uppercase section labels

**Italic:**
- `italic` — View-only / disabled track names

---

## Button System

Buttons are defined as `@layer components` in `styles.scss` and composed with Tailwind. All buttons set `cursor: pointer` globally.

### Base Button Classes

**`.btn-primary`** — Main action button (filled, accent color):
```scss
px-4 py-2.5 rounded-lg font-semibold text-white bg-daw-accent hover:opacity-90 transition-opacity disabled:opacity-50
```

**`.btn-secondary`** — Neutral/cancel button (panel fill):
```scss
px-4 py-2 rounded-lg text-sm font-medium bg-daw-panel text-daw-text
```

**`.btn-danger`** — Destructive action (red fill):
```scss
px-4 py-2.5 rounded-lg font-semibold text-white bg-daw-danger
```

**`.btn-warning`** — Warning/caution action (amber fill, dark text):
```scss
px-4 py-2.5 rounded-lg font-semibold bg-daw-warning text-daw-bg
```

**`.btn-ghost`** — Subtle tertiary action (transparent with accent border):
```scss
px-3 py-1.5 rounded text-sm font-medium bg-transparent border border-daw-accent text-daw-accent hover:opacity-80
```

---

### Button Size Overrides

The base classes set default padding. Override with additional classes at the use-site:

| Override | Use case |
|---|---|
| `w-full` | Full-width buttons inside forms and modals |
| `px-7 py-3 text-base` | Large hero/CTA button |
| `px-4 py-2 text-sm` | Standard form button (most common) |
| `px-3 py-1 text-xs` | Compact inline buttons (toolbar, chips) |
| `px-2 py-1 text-xs` | Tiny inline actions (comment area) |
| `px-2 py-0.5` | Extra-small tags/chips with button behavior |
| `flex-1` | Equal-width sibling buttons in a row |

Example override — large primary:
```html
<button class="btn-primary px-7 py-3 text-base font-semibold">Get Started</button>
```

Example override — small secondary:
```html
<button class="btn-secondary px-3 py-1 text-xs">Cancel</button>
```

---

### Icon Buttons (DAW toolbar pattern)

Square icon-only buttons used in audio controls and toolbars — no base class, styled inline:
```html
<button class="w-9 h-9 flex items-center justify-center rounded">...</button>
<button class="w-7 h-7 flex items-center justify-center rounded">...</button>
<button class="w-6 h-6 flex items-center justify-center rounded">...</button>
```

---

### Disabled State

All buttons use opacity to signal disabled — no color change:
```html
<button class="btn-primary" [disabled]="isLoading" disabled:opacity-50>Submit</button>
```

Common disabled opacity values: `disabled:opacity-50`, `disabled:opacity-40`, `disabled:opacity-30`.
Pair with `disabled:cursor-not-allowed` when needed.

---

### Link-style Buttons

No background or border — just text with hover underline:
```html
<button class="hover:underline">Forgot password?</button>
```

---

### Button Groups

Two equal-width buttons side by side (modals, confirmations):
```html
<div class="flex gap-3 mt-4">
  <button class="btn-secondary flex-1">Cancel</button>
  <button class="btn-primary flex-1">Confirm</button>
</div>
```

Buttons right-aligned in a form:
```html
<div class="flex justify-end gap-3 mt-4">
  <button class="btn-secondary">Cancel</button>
  <button class="btn-primary">Save</button>
</div>
```

---

## Badges & Chips

**Status badges (component classes):**
```html
<span class="badge-public">Public</span>
<span class="badge-private">Private</span>
```
Both are `flex items-center gap-1 text-xs font-medium`.

**Keyword chips (tags):**
```html
<span class="px-2 py-0.5 rounded-full text-xs bg-daw-panel text-daw-text-secondary">
  jazz
</span>
```

**Removable chips (inline, with × button):**
```html
<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-daw-panel">
  jazz <button>×</button>
</span>
```

---

## Form Labels

Standard label above an input:
```html
<label class="block text-sm mb-1">Username</label>
<label class="block text-sm mb-2">Email</label>
```

Uppercase section label (used as a fieldset-style header):
```html
<p class="text-xs text-daw-muted uppercase tracking-wider">Input Device</p>
```

---

## Key Sizing Conventions

- **Modal padding:** `p-6` or `p-8` inside `modal-container`
- **Card padding:** `p-4` or `p-5`
- **Input height:** `py-2.5 px-4` (matches `btn-primary` vertically)
- **Border radius:** `rounded-lg` for buttons/inputs, `rounded-xl` for modals, `rounded-full` for chips/badges
- **Gap between buttons:** `gap-3` in most groups
