# Label Dashboard API - Database Models

This document provides a comprehensive overview of all the Sequelize TypeScript models created for the Label Dashboard API.

## Model Overview

All models have been converted from the original JavaScript Sequelize models to TypeScript with proper type definitions, interfaces, and relationships.

### Core Models

#### 1. **User** (`src/models/User.ts`)
```typescript
interface UserAttributes {
  id: number;
  username?: string;
  password_md5?: string;
  email_address: string;
  first_name?: string;
  last_name?: string;
  profile_photo?: string;
  is_admin: boolean;
  brand_id: number;
  reset_hash?: string;
  last_logged_in?: Date;
}
```
**Relationships:**
- `belongsTo Brand`
- `hasMany LoginAttempt`
- `belongsToMany Artist` (through ArtistAccess)

#### 2. **Brand** (`src/models/Brand.ts`)
```typescript
interface BrandAttributes {
  id: number;
  brand_name: string;
  logo_url?: string;
  brand_color: string;
}
```
**Relationships:**
- `hasMany User`
- `hasMany Artist`
- `hasMany Event`
- `hasMany Release`
- `hasMany RecuperableExpense`
- `hasMany LoginAttempt`
- `hasMany Domain`

#### 3. **Artist** (`src/models/Artist.ts`)
```typescript
interface ArtistAttributes {
  id: number;
  name: string;
  facebook_handle?: string;
  instagram_handle?: string;
  twitter_handle?: string;
  bio?: string;
  website_page_url?: string;
  profile_photo?: string;
  brand_id: number;
  tiktok_handle?: string;
  band_members?: string;
  youtube_channel?: string;
  payout_point: number;
}
```
**Relationships:**
- `belongsTo Brand`
- `hasMany Payment`
- `hasMany PaymentMethod`
- `hasMany Royalty`
- `hasMany ArtistImage`
- `hasMany ArtistDocument`
- `belongsToMany User` (through ArtistAccess)
- `belongsToMany Release` (through ReleaseArtist)

### Music & Release Management

#### 4. **Release** (`src/models/Release.ts`)
```typescript
interface ReleaseAttributes {
  id: number;
  title?: string;
  catalog_no: string;
  UPC?: string;
  spotify_link?: string;
  apple_music_link?: string;
  youtube_link?: string;
  release_date?: Date;
  status: 'Pending' | 'Live' | 'Taken Down';
  cover_art?: string;
  brand_id: number;
}
```
**Relationships:**
- `belongsTo Brand`
- `hasMany Earning`
- `hasMany Royalty`
- `hasMany RecuperableExpense`
- `belongsToMany Artist` (through ReleaseArtist)

#### 5. **ReleaseArtist** (`src/models/ReleaseArtist.ts`)
Many-to-many relationship table between Release and Artist with royalty information:
```typescript
interface ReleaseArtistAttributes {
  artist_id: number;
  release_id: number;
  streaming_royalty_percentage: number;
  streaming_royalty_type: 'Revenue' | 'Profit';
  sync_royalty_percentage: number;
  sync_royalty_type: 'Revenue' | 'Profit';
  download_royalty_percentage: number;
  download_royalty_type: 'Revenue' | 'Profit';
  physical_royalty_percentage: number;
  physical_royalty_type: 'Revenue' | 'Profit';
}
```

### Event Management

#### 6. **Event** (`src/models/Event.ts`)
```typescript
interface EventAttributes {
  id: number;
  brand_id: number;
  title: string;
  date_and_time: Date;
  venue: string;
  description?: string;
  poster_url?: string;
  rsvp_link?: string;
  ticket_price: number;
  buy_shortlink?: string;
  close_time?: Date;
}
```
**Relationships:**
- `belongsTo Brand`
- `hasMany Ticket`
- `hasMany EventReferrer`

#### 7. **EventReferrer** (`src/models/EventReferrer.ts`)
```typescript
interface EventReferrerAttributes {
  id: number;
  name: string;
  referral_code: string;
  event_id: number;
  referral_shortlink?: string;
}
```

#### 8. **Ticket** (`src/models/Ticket.ts`)
```typescript
interface TicketAttributes {
  id: number;
  event_id: number;
  name: string;
  email_address: string;
  contact_number?: string;
  number_of_entries: number;
  ticket_code: string;
  status: 'New' | 'Payment Confirmed' | 'Ticket sent.' | 'Canceled';
  payment_link?: string;
  payment_link_id?: string;
  price_per_ticket?: number;
  payment_processing_fee?: number;
  referrer_id?: number;
}
```

### Financial Management

#### 9. **Payment** (`src/models/Payment.ts`)
```typescript
interface PaymentAttributes {
  id: number;
  description?: string;
  amount: number;
  artist_id: number;
  date_paid: Date;
  paid_thru_type?: string;
  paid_thru_account_name?: string;
  paid_thru_account_number?: string;
}
```

#### 10. **PaymentMethod** (`src/models/PaymentMethod.ts`)
```typescript
interface PaymentMethodAttributes {
  id: number;
  artist_id: number;
  type: string;
  account_name: string;
  account_number_or_email: string;
  is_default_for_artist: boolean;
  bank_code: string;
}
```

#### 11. **Earning** (`src/models/Earning.ts`)
```typescript
interface EarningAttributes {
  id: number;
  release_id: number;
  type: 'Sync' | 'Streaming' | 'Downloads' | 'Physical';
  amount?: number;
  description?: string;
  date_recorded: Date;
}
```

#### 12. **Royalty** (`src/models/Royalty.ts`)
```typescript
interface RoyaltyAttributes {
  id: number;
  artist_id: number;
  earning_id?: number;
  percentage_of_earning?: number;
  amount: number;
  release_id?: number;
  description?: string;
  date_recorded: Date;
}
```

#### 13. **RecuperableExpense** (`src/models/RecuperableExpense.ts`)
```typescript
interface RecuperableExpenseAttributes {
  id: number;
  release_id: number;
  expense_description: string;
  expense_amount: number;
  date_recorded?: Date;
  brand_id: number;
}
```

### Supporting Models

#### 14. **ArtistImage** (`src/models/ArtistImage.ts`)
```typescript
interface ArtistImageAttributes {
  id: number;
  path: string;
  credits?: string;
  artist_id: number;
  date_uploaded: Date;
}
```

#### 15. **ArtistDocument** (`src/models/ArtistDocument.ts`)
```typescript
interface ArtistDocumentAttributes {
  id: number;
  title?: string;
  path: string;
  date_uploaded?: Date;
  artist_id: number;
}
```

#### 16. **ArtistAccess** (`src/models/ArtistAccess.ts`)
Many-to-many relationship table between User and Artist with permission settings:
```typescript
interface ArtistAccessAttributes {
  artist_id: number;
  user_id: number;
  can_view_payments: boolean;
  can_view_royalties: boolean;
  can_edit_artist_profile: boolean;
  status: 'Pending' | 'Accepted';
  invite_hash?: string;
}
```

#### 17. **Domain** (`src/models/Domain.ts`)
```typescript
interface DomainAttributes {
  brand_id: number;
  domain_name: string;
  status: 'Verified' | 'Unverified' | 'Pending';
}
```

#### 18. **LoginAttempt** (`src/models/LoginAttempt.ts`)
```typescript
interface LoginAttemptAttributes {
  id: number;
  user_id: number;
  status: 'Successful' | 'Failed';
  date_and_time: Date;
  brand_id: number;
  proxy_ip?: string;
  remote_ip?: string;
}
```

## Model Relationships Summary

### Key Relationships:
1. **Brand → Users, Artists, Events, Releases** (One-to-Many)
2. **Artist ↔ Release** (Many-to-Many via ReleaseArtist)
3. **User ↔ Artist** (Many-to-Many via ArtistAccess)
4. **Release → Earnings → Royalties** (One-to-Many chains)
5. **Event → Tickets** (One-to-Many)
6. **EventReferrer → Tickets** (One-to-Many)

### Database Features:
- **Multi-tenant**: Brand-based separation
- **Role-based Access**: Admin/user permissions
- **Audit Trail**: Login attempts tracking
- **File Management**: Artist images and documents
- **Financial Tracking**: Payments, royalties, expenses
- **Event Management**: Ticket sales with referral system

## Usage Example

```typescript
import { Artist, Release, User, Brand } from '../models';

// Find artist with releases and brand
const artist = await Artist.findByPk(1, {
  include: [
    { model: Brand, as: 'brand' },
    { model: Release, as: 'releases' },
    { model: Payment, as: 'payments' }
  ]
});

// Create new release with artist association
const release = await Release.create({
  title: 'New Album',
  catalog_no: 'CAT001',
  brand_id: 1
});

await ReleaseArtist.create({
  artist_id: 1,
  release_id: release.id,
  streaming_royalty_percentage: 0.5
});
```

## Migration Notes

- **Password Security**: Models support both MD5 (legacy) and bcrypt (new) hashing
- **Timestamps**: Most tables use `timestamps: false` to match original PHP structure
- **Decimal Precision**: Financial amounts use `DECIMAL(10,2)` for accuracy
- **Enum Types**: Status fields use proper TypeScript enum types
- **Foreign Keys**: All relationships properly defined with foreign key constraints

All models are fully typed and include proper validation, making the API type-safe and maintainable.