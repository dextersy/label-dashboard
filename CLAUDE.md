# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Melt Records Artist Dashboard - a multi-brand label management system that allows music labels to provide transparent financial reporting to their artists. The project consists of four main components:

1. **Legacy PHP Application** (`src/`) - Original dashboard implementation
2. **Node.js/TypeScript API** (`src_new/label-dashboard-api/`) - Modern backend API
3. **Angular Frontend** (`src_new/label-dashboard-web/`) - Modern web interface
4. **Ticketing App** (`src_new/ticketing-app/`) - Standalone Angular app for event organizers to manage ticket sales, walk-in sales, affiliates, and communications
5. **Spindly.app** (`src_new/spindly.app/`) - Standalone Angular marketing/landing site for spindly.app

## Project Aliases
- **"spindly.app project"** or **"Spindly"** always refers to `src_new/spindly.app/`. Never confuse with `src_new/ticketing-app/`.
- **"Your Scene"** is interchangeable with **"ticketing-app"** — it is the current brand name for `src_new/ticketing-app/`.
- **"Dashboard"** refers to `src_new/label-dashboard-web/`.

## Common Development Commands

### Backend API (Node.js/TypeScript)
```bash
cd src_new/label-dashboard-api
npm run dev              # Start development server with nodemon
npm run dev:debug        # Start with debugging enabled
npm run build            # Compile TypeScript to JavaScript
npm run start            # Run compiled JavaScript
```

### Frontend (Angular)
```bash
cd src_new/label-dashboard-web
npm start                # Start development server (ng serve)
npm run build            # Build for production
ng test                  # Run tests
ng build --watch         # Build with file watching
```

### Ticketing App (Angular, port 4201)
```bash
cd src_new/ticketing-app
npm start                # Dev server using environment.ts (no Google Maps)
npm run start:local      # Dev server using environment.local.ts (Google Maps key, recommended)
npm run build            # Production build
```

> **Important**: The ticketing app requires `--configuration=local` to use the Google Maps API key for venue autocomplete. Copy `src/environments/environment.local.ts.example` to `src/environments/environment.local.ts` and fill in your key.

### Database Models Generation
```bash
cd db_api
# Generate Sequelize models from existing MySQL database
npx sequelize-auto -o "./models" -d meltrecords_dashboard -h localhost -u [username] -p [port] -x [password] -e mysql
```

## Architecture Overview

### Backend API Structure
- **Controllers** (`src_new/label-dashboard-api/src/controllers/`) - Handle HTTP requests and responses
- **Models** (`src_new/label-dashboard-api/src/models/`) - Sequelize ORM models for database entities
- **Routes** (`src_new/label-dashboard-api/src/routes/`) - API endpoint definitions
- **Middleware** (`src_new/label-dashboard-api/src/middleware/`) - Authentication and other middleware
- **Utils** (`src_new/label-dashboard-api/src/utils/`) - Email and payment services

### Frontend Structure (label-dashboard-web)
- **Pages** (`src_new/label-dashboard-web/src/app/pages/`) - Main application pages (dashboard, artist, financial, etc.)
- **Components** (`src_new/label-dashboard-web/src/app/components/`) - Reusable UI components organized by feature
- **Services** (`src_new/label-dashboard-web/src/app/services/`) - Data services and state management
- **Guards** (`src_new/label-dashboard-web/src/app/guards/`) - Route protection (auth, admin)

### Ticketing App Structure (ticketing-app)
Standalone Angular 17 app. All components are standalone (no NgModules). Uses Tailwind CSS.
- **Pages** (`src_new/ticketing-app/src/app/pages/`) - `auth/` (login, signup, forgot-password), `dashboard/`, `events/` (list, detail, form)
- **Services** (`src_new/ticketing-app/src/app/services/`) - `auth`, `events`, `tickets`, `ticket-type`, `walk-in`, `referrer`, `google-places`
- **Models** (`src_new/ticketing-app/src/app/models/`) - `event`, `ticket`, `ticket-type`, `walk-in-transaction`, `walk-in-type`, `event-referrer`
- **Guards** (`src_new/ticketing-app/src/app/guards/`) - `auth.guard` protects all routes except login/signup/forgot-password
- **Interceptors** (`src_new/ticketing-app/src/app/interceptors/`) - `auth.interceptor` attaches JWT to all HTTP requests
- **Environments** (`src_new/ticketing-app/src/environments/`) - `environment.ts` (default, no Maps key), `environment.local.ts` (gitignored, has Maps key)

### Key Domain Models
- **Brand** - Multi-tenant label/brand system with domain-based routing
- **Artist** - Musicians signed to labels with team management
- **Release** - Albums/singles with metadata and financial tracking
- **Event** - Live shows with ticket sales integration
- **Financial** - Earnings, payments, royalties, and expenses tracking
- **User** - Authentication and role-based access control

## Multi-Brand Architecture

The system supports multiple labels/brands through:
- Domain-based brand detection (`BrandService.loadBrandByDomain()`)
- Brand-specific styling (colors, logos, favicons)
- Isolated data per brand with proper access controls
- Brand hierarchy support (parent/child brands)

### CRITICAL SECURITY RULE: Multi-Brand URL Generation
**NEVER use fallback URLs (like `process.env.FRONTEND_URL`) in multi-brand contexts, especially for invite links, password resets, or any user-facing URLs.** This is a serious security vulnerability that can expose users to the wrong brand context or allow cross-brand data access.

**Always use brand-specific domains:**
- Use `getBrandFrontendUrl(brandId)` from `src_new/label-dashboard-api/src/utils/brandUtils.ts` to get the correct domain
- If no domain is found for a brand, it falls back to the parent brand's domain (supports organizer sub-brands that inherit the platform domain). If no domain is found at all, it throws an error — never falls back to an environment variable.
- This ensures that all user interactions happen within the correct brand context
- Example: Admin invites must only work on the specific brand's domain that sent the invite

## Authentication & Authorization

- JWT-based authentication with role-based access control
- User roles: Admin, Artist, Team Member
- Artist-specific access controls through `ArtistAccess` model
- Route guards for protecting admin and authenticated routes

### Ticketing Organizer Auth
The ticketing app uses dedicated auth endpoints scoped to a configured parent brand:
- `POST /auth/ticketing/signup` — Creates a new sub-brand under `TICKETING_PARENT_BRAND_ID`, copies the parent brand's primary domain to the sub-brand, and creates an admin user for it. Each organizer gets their own isolated brand.
- `POST /auth/ticketing/login` — Authenticates a user only if they belong to the ticketing parent brand or one of its sub-brands. Rejects users from unrelated brands.

Set `TICKETING_PARENT_BRAND_ID` in the API `.env` to the brand ID that acts as the root of the ticketing organizer hierarchy.

## Development Workflow

1. **Backend First**: Check existing APIs in `label-dashboard-api` before creating new endpoints
2. **Reuse Components**: Look for existing Angular components before creating new ones
3. **Follow Patterns**: Mimic existing code patterns for consistency
4. **Bootstrap Styling**: Use Bootstrap classes whenever possible
5. **Never Modify Legacy**: Do not change files in `src/` (legacy PHP code)
6. **No Automatic Building/Testing**: By default, do not build or test code unless specifically requested by the user. The user will report any build errors or issues that need to be addressed.
7. **Never Build the App**: Do not run `npm run build`, `npm start`, or any build/test commands. The user will handle building and testing themselves.
8. **S3 Cleanup**: Whenever a new S3 file upload is implemented (any new model field stored in S3), always update `getUsedS3Urls` in `src_new/label-dashboard-api/src/controllers/systemController.ts` to include that field. This prevents the S3 cleanup job from deleting files that are still in use.
9. **Database Migrations**: Whenever a database schema change is made (adding/removing/modifying columns or tables in Sequelize models), always create a corresponding Sequelize CLI migration file in `src_new/label-dashboard-api/migrations/`. Follow the existing naming convention: `YYYYMMDD000001-description.js`. Include both `up` and `down` methods. Use the current date for the timestamp prefix.
10. **No Hardcoded Brand Names**: Never use specific brand names (e.g. "scenetix", "spindly", or any other label name) as string literals, identifiers, variable names, comments, or any other code content. Brands are dynamic data loaded from the database. Hardcoding brand names creates brittle code that breaks when brands are added, renamed, or removed. Always reference brands generically (e.g. `brand.name`, `brand.slug`) or through the Brand model/service.

## Angular Frontend Reference Documents

Two documents in `src_new/label-dashboard-web/` must be consulted for all Angular frontend work:

- **`FRONTEND_STRUCTURE.md`** — Read this before creating any new Angular file. It defines where files go, naming conventions, placement rules, architectural patterns, and import path depths.
- **`DESIGN_SYSTEM.md`** — Read the relevant section(s) before implementing or modifying any UI. It covers typography, colors, cards, buttons, forms, tables, loading states, modals, icons, layout shell, and the full API for every shared component (`FloatingActionBarComponent`, `PaginatedTableComponent`, `DateRangeFilterComponent`, `InPageNavComponent`, etc.).

## Database Configuration

The API connects to MySQL using Sequelize ORM. Database configuration is handled in:
- `src_new/label-dashboard-api/src/config/database.ts`
- Environment variables for connection details
- Auto-sync models on startup with foreign key constraints

## Environment Setup

All components require environment configuration:
- **API**: Uses `.env` file for database, SMTP, and SSL certificates. Key ticketing-specific variable: `TICKETING_PARENT_BRAND_ID` (brand ID that is the root of the organizer hierarchy — required for organizer signup/login).
- **label-dashboard-web**: Uses `src/environments/` for API endpoints and build configs
- **ticketing-app**: Uses `src_new/ticketing-app/src/environments/environment.ts` (default) or `environment.local.ts` (local dev, gitignored). The local config enables Google Maps venue autocomplete. Copy `environment.local.ts.example` to get started.

## Development Server Script

`start_dev.sh` (project root) starts all services together:
- API on port 3000
- label-dashboard-web on default Angular port (4200)
- ticketing-app on port 4201 with `--configuration=local`
- Optional ngrok tunnel (pass domain as first argument)

Run: `bash start_dev.sh [optional-ngrok-domain]`

## Testing

- API: No test framework currently configured
- Frontend: Uses Jasmine/Karma (standard Angular testing setup)
- Run `ng test` in the frontend directory for component tests