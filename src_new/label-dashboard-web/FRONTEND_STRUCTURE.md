# Frontend Structure Reference

Reference for the Angular frontend at `src_new/label-dashboard-web/src/app/`.
Use this whenever creating new components, pages, services, or any other frontend file.

For UI patterns, component APIs, and styling conventions, see `DESIGN_SYSTEM.md` (same directory).

---

## Quick Reference: Where to Put New Files

| What you're creating | Where it goes |
|---|---|
| A routable page | `pages/<feature>/<feature>.component.ts` |
| A component used by exactly one page | `pages/<feature>/components/<name>.component.ts` |
| A component used by 2+ pages or by the app shell | `components/shared/<name>/` |
| A layout/shell component (navbar, sidebar) | `shared/<name>/` |
| A TypeScript interface/type used in 2+ files | `models/<name>.model.ts` |
| A service | `services/<name>.service.ts` |
| A route guard | `guards/<name>.guard.ts` |
| An HTTP interceptor | `interceptors/<name>.interceptor.ts` |
| A pipe | `pipes/<name>.pipe.ts` |
| A directive | `directives/<name>.directive.ts` |
| A pure utility function | `utils/<name>.ts` |

---

## Architectural Patterns

### All components are standalone

All components use Angular's standalone API with explicit `imports: []`. There are no NgModules.

### Tab-based page containers

Several pages are thin containers that render a child component based on `data.tab` in the route:

```ts
{ path: 'financial/summary', component: FinancialComponent, data: { tab: 'summary' } }
```

The container reads `this.route.data` and conditionally renders the matching tab component. Pages using this pattern: `admin`, `artist`, `financial`, `events`, `fundraisers`.

All tab sub-components and their associated dialogs/modals live in `pages/<feature>/components/`.

### Smart/dumb component split

- **Pages** (`pages/`) are smart — they own routing, data fetching, and state.
- **Shared components** (`components/`) are dumb — they receive `@Input` data and emit `@Output` events.

### `components/shared/` vs `shared/`

Two directories both named "shared" serve different purposes:

| Directory | Purpose | Examples |
|---|---|---|
| `components/shared/` | Generic UI widgets reused across features | `paginated-table`, `date-range-filter`, `in-page-nav`, `floating-action-bar`, `artist-selection` |
| `shared/` | App shell layout (rendered by the root component) | `navbar`, `sidebar`, `breadcrumb`, `footer` |

### Import path depths

The number of `../` levels depends on how deep the file sits under `src/app/`:

| File location | Depth | Path to `src/app/services/` |
|---|---|---|
| `pages/<feature>/<feature>.component.ts` | 2 | `../../services/` |
| `pages/<feature>/components/<name>.component.ts` | 3 | `../../../services/` |
| `pages/<feature>/components/<sub>/<name>.component.ts` | 4 | `../../../../services/` |
| `components/shared/<name>/<name>.component.ts` | 3 | `../../../services/` |
| `shared/<name>/<name>.component.ts` | 2 | `../../services/` |

---

## Placement Rules for New Components

Ask: **who imports this component?**

| Imported by | Location |
|---|---|
| Only one page | `pages/<that-feature>/components/<name>/` |
| Two or more pages, or by `shared/` shell components | `components/shared/<name>/` |

Do **not** create new `components/<feature>/` directories. The only subdirectory of `components/` besides `shared/` is the three cross-cutting app-level components (`connection-overlay`, `global-notification`, `onboarding`).

If a component starts as single-page-only and later gets used by a second page, move it to `components/shared/` at that point.

---

## Naming Conventions

| Artifact | File name | Class name | Selector |
|---|---|---|---|
| Component | `feature-name.component.ts` | `FeatureNameComponent` | `app-feature-name` |
| Tab sub-component | `feature-name-tab.component.ts` | `FeatureNameTabComponent` | `app-feature-name-tab` |
| Dialog (Material CDK) | `feature-name-dialog.component.ts` | `FeatureNameDialogComponent` | `app-feature-name-dialog` |
| Modal (Bootstrap) | `feature-name-modal.component.ts` | `FeatureNameModalComponent` | `app-feature-name-modal` |
| Service | `feature-name.service.ts` | `FeatureNameService` | — |
| Guard | `feature-name.guard.ts` | exported function `featureNameGuard` | — |
| Interceptor | `feature-name.interceptor.ts` | `FeatureNameInterceptor` | — |
| Pipe | `feature-name.pipe.ts` | `FeatureNamePipe` | `featureName` |
| Directive | `feature-name.directive.ts` | `FeatureNameDirective` | `appFeatureName` |
| Model/Interface | `feature-name.model.ts` | `FeatureName` (interface) | — |
| Utility | `feature-name.ts` | n/a (exported functions) | — |

Tab sub-components use the `-tab` suffix regardless of their visual appearance in the UI. It signals they are rendered by a container based on route `data.tab`.
