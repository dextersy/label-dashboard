# Test Plan: Add Sublabel Feature

## Summary
The "Add Sublabel" feature has been successfully implemented with the following components:

### Frontend Changes:
1. **Add Sublabel Modal Component** (`src_new/label-dashboard-web/src/app/components/shared/add-sublabel-modal/`)
   - Form validation for brand name and domain name
   - Loading states and error handling
   - Responsive modal design

2. **Child Brands Tab Integration** (`src_new/label-dashboard-web/src/app/pages/admin/components/child-brands-tab.component.ts`)
   - "Add Sublabel" button (visible only to superadmins)
   - Modal integration and event handling
   - Automatic refresh after successful creation

3. **Admin Service** (`src_new/label-dashboard-web/src/app/services/admin.service.ts`)
   - `createSublabel()` method for API calls

### Backend Changes:
1. **Auth Middleware** (`src_new/label-dashboard-api/src/middleware/auth.ts`)
   - Added `requireSuperAdmin()` middleware that checks user email against `ADMIN_EMAIL` env variable

2. **Brand Controller** (`src_new/label-dashboard-api/src/controllers/brandController.ts`)
   - `createSublabel()` function that creates:
     - New brand with parent relationship
     - Domain record (unverified status)
     - Admin user (copy of current user for new brand)

3. **Brand Routes** (`src_new/label-dashboard-api/src/routes/brand.ts`)
   - `POST /:brandId/sublabels` endpoint with superadmin protection

## Features:
- ✅ **Superadmin-only access**: Button and API endpoint protected
- ✅ **Form validation**: Domain format and required field validation
- ✅ **Complete sublabel creation**: Brand, domain, and user records
- ✅ **Default settings**: Gray color, 10% processing fee, unverified domain
- ✅ **Error handling**: User-friendly error messages
- ✅ **Auto-refresh**: Table updates after successful creation
- ✅ **Sortable columns**: All sublabel columns are sortable

## Default Values Created:
- **Brand**: Parent brand relationship, gray color (#6c757d), 10% processing fee
- **Domain**: Unverified status, linked to new brand
- **User**: Copy of current user's info, admin for new brand, cleared reset/login data

## Testing Requirements:
1. **Environment Variable**: Set `ADMIN_EMAIL` in .env file to the superadmin's email address
2. **Superadmin User**: User with email matching `ADMIN_EMAIL` env variable
3. **UI Test**: Verify button appears only for superadmins
4. **Functionality Test**: Create sublabel and verify all records are created correctly
5. **Permissions Test**: Verify non-superadmins cannot access the endpoint

## Security:
- Frontend: UI elements hidden from non-superadmins (email-based check)
- Backend: Endpoint protected with `requireSuperAdmin` middleware (env-based check)
- Validation: Domain format validation, input sanitization