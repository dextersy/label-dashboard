# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Melt Records Artist Dashboard - a multi-brand label management system that allows music labels to provide transparent financial reporting to their artists. The project consists of three main components:

1. **Legacy PHP Application** (`src/`) - Original dashboard implementation
2. **Node.js/TypeScript API** (`src_new/label-dashboard-api/`) - Modern backend API
3. **Angular Frontend** (`src_new/label-dashboard-web/`) - Modern web interface

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

### Frontend Structure
- **Pages** (`src_new/label-dashboard-web/src/app/pages/`) - Main application pages (dashboard, artist, financial, etc.)
- **Components** (`src_new/label-dashboard-web/src/app/components/`) - Reusable UI components organized by feature
- **Services** (`src_new/label-dashboard-web/src/app/services/`) - Data services and state management
- **Guards** (`src_new/label-dashboard-web/src/app/guards/`) - Route protection (auth, admin)

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
- Use `getBrandFrontendUrl(brandId)` from `src/utils/brandUtils.ts` to get the correct domain
- If no domain is found for a brand, return an error rather than falling back to a generic URL
- This ensures that all user interactions happen within the correct brand context
- Example: Admin invites must only work on the specific brand's domain that sent the invite

## Authentication & Authorization

- JWT-based authentication with role-based access control
- User roles: Admin, Artist, Team Member
- Artist-specific access controls through `ArtistAccess` model
- Route guards for protecting admin and authenticated routes

## Development Workflow

1. **Backend First**: Check existing APIs in `label-dashboard-api` before creating new endpoints
2. **Reuse Components**: Look for existing Angular components before creating new ones
3. **Follow Patterns**: Mimic existing code patterns for consistency
4. **Bootstrap Styling**: Use Bootstrap classes whenever possible
5. **Never Modify Legacy**: Do not change files in `src/` (legacy PHP code)

## Database Configuration

The API connects to MySQL using Sequelize ORM. Database configuration is handled in:
- `src_new/label-dashboard-api/src/config/database.ts`
- Environment variables for connection details
- Auto-sync models on startup with foreign key constraints

## Environment Setup

Both API and frontend require environment configuration:
- API: Uses `.env` file for database, SMTP, and SSL certificates
- Frontend: Uses `src/environments/` for API endpoints and build configs

## Testing

- API: No test framework currently configured
- Frontend: Uses Jasmine/Karma (standard Angular testing setup)
- Run `ng test` in the frontend directory for component tests