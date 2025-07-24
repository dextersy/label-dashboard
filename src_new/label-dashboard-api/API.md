# Label Dashboard API Documentation

This document provides comprehensive documentation for the Label Dashboard Express.js API, which replaces the original PHP backend.

## Base URL
```
http://localhost:3000/api
```

## Authentication

The API uses JWT (JSON Web Token) based authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## API Endpoints

### 🔐 Authentication (`/api/auth`)

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "password123",
  "brand_id": 1
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email_address": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_admin": true,
    "brand_id": 1
  }
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

---

### 👥 User Management (`/api/users`)

#### Check Username Availability
```http
POST /api/users/check-username

{
  "username": "new_user",
  "brand_id": 1
}
```

**Response:**
```json
{
  "result": "false"
}
```

#### Send Password Reset Link
```http
POST /api/users/send-reset-link

{
  "email_address": "user@example.com",
  "brand_id": 1
}
```

#### Initialize New User
```http
POST /api/users/init

{
  "username": "new_user",
  "email_address": "user@example.com",
  "first_name": "New",
  "last_name": "User",
  "password": "secure_password",
  "brand_id": 1
}
```

#### Invite User (Admin Only)
```http
POST /api/users/invite
Authorization: Bearer <admin-token>

{
  "email_address": "invite@example.com",
  "first_name": "Invited",
  "artist_id": 1,
  "can_view_payments": true,
  "can_view_royalties": true,
  "can_edit_artist_profile": true
}
```

---

### 🎤 Artist Management (`/api/artists`)

#### Get All Artists
```http
GET /api/artists
Authorization: Bearer <token>
```

**Response:**
```json
{
  "artists": [
    {
      "id": 1,
      "name": "Artist Name",
      "bio": "Artist biography...",
      "facebook_handle": "artistpage",
      "instagram_handle": "artistig",
      "brand_id": 1,
      "payout_point": 1000
    }
  ]
}
```

#### Get Single Artist
```http
GET /api/artists/1
Authorization: Bearer <token>
```

#### Create Artist (Admin Only)
```http
POST /api/artists
Authorization: Bearer <admin-token>

{
  "name": "New Artist",
  "bio": "Artist biography",
  "facebook_handle": "newartist",
  "instagram_handle": "newartist_ig",
  "website_page_url": "https://newartist.com",
  "payout_point": 1500
}
```

#### Update Artist
```http
PUT /api/artists/1
Authorization: Bearer <token>

{
  "name": "Updated Artist Name",
  "bio": "Updated biography",
  "notify_changes": true
}
```

#### Set Selected Artist
```http
POST /api/artists/set-selected
Authorization: Bearer <token>

{
  "artist_id": 1
}
```

#### Get Artist Balance
```http
GET /api/artists/1/balance
Authorization: Bearer <token>
```

**Response:**
```json
{
  "artist_id": 1,
  "artist_name": "Artist Name",
  "total_royalties": 5000.00,
  "total_payments": 3000.00,
  "current_balance": 2000.00,
  "payout_point": 1000,
  "ready_for_payout": true
}
```

---

### 💿 Release Management (`/api/releases`)

#### Get All Releases
```http
GET /api/releases
Authorization: Bearer <token>
```

#### Get Single Release
```http
GET /api/releases/1
Authorization: Bearer <token>
```

#### Create Release (Admin Only)
```http
POST /api/releases
Authorization: Bearer <admin-token>

{
  "title": "New Album",
  "catalog_no": "CAT001",
  "UPC": "123456789012",
  "spotify_link": "https://open.spotify.com/album/...",
  "release_date": "2024-01-15",
  "status": "Pending",
  "artists": [
    {
      "artist_id": 1,
      "streaming_royalty_percentage": 0.5,
      "streaming_royalty_type": "Revenue"
    }
  ]
}
```

#### Update Release
```http
PUT /api/releases/1
Authorization: Bearer <token>

{
  "title": "Updated Album Title",
  "status": "Live",
  "artists": [
    {
      "artist_id": 1,
      "streaming_royalty_percentage": 0.6,
      "sync_royalty_percentage": 0.5
    }
  ]
}
```

#### Get Release Earnings
```http
GET /api/releases/1/earnings
Authorization: Bearer <token>
```

---

### 🎫 Event & Ticket Management (`/api/events`)

#### Get All Events
```http
GET /api/events
Authorization: Bearer <token>
```

#### Create Event (Admin Only)
```http
POST /api/events
Authorization: Bearer <admin-token>

{
  "title": "Live Concert",
  "date_and_time": "2024-02-15T20:00:00Z",
  "venue": "Music Hall",
  "description": "Amazing live performance",
  "ticket_price": 500,
  "close_time": "2024-02-15T18:00:00Z"
}
```

#### Add Ticket (Admin Only)
```http
POST /api/events/tickets
Authorization: Bearer <admin-token>

{
  "event_id": 1,
  "name": "John Doe",
  "email_address": "john@example.com",
  "contact_number": "+639123456789",
  "number_of_entries": 2,
  "referrer_code": "FRIEND123"
}
```

**Response:**
```json
{
  "message": "Ticket created successfully",
  "ticket": {
    "id": 1,
    "ticket_code": "ABC123",
    "payment_link": "https://checkout.paymongo.com/...",
    "total_amount": 1050
  }
}
```

#### Get Tickets
```http
GET /api/events/tickets?event_id=1
Authorization: Bearer <token>
```

#### Mark Ticket as Paid (Admin Only)
```http
POST /api/events/tickets/mark-paid
Authorization: Bearer <admin-token>

{
  "ticket_id": 1
}
```

---

### 💰 Financial Management (`/api/financial`)

#### Add Earning (Admin Only)
```http
POST /api/financial/earnings
Authorization: Bearer <admin-token>

{
  "release_id": 1,
  "type": "Streaming",
  "amount": 1000.50,
  "description": "Spotify earnings for January",
  "date_recorded": "2024-01-31",
  "calculate_royalties": true
}
```

#### Bulk Add Earnings (Admin Only)
```http
POST /api/financial/earnings/bulk
Authorization: Bearer <admin-token>

{
  "earnings": [
    {
      "release_id": 1,
      "type": "Streaming",
      "amount": 500.00,
      "date_recorded": "2024-01-01",
      "calculate_royalties": true
    },
    {
      "release_id": 2,
      "type": "Downloads",
      "amount": 200.00,
      "date_recorded": "2024-01-01"
    }
  ]
}
```

#### Add Payment (Admin Only)
```http
POST /api/financial/payments
Authorization: Bearer <admin-token>

{
  "artist_id": 1,
  "amount": 2000.00,
  "description": "January payout",
  "date_paid": "2024-02-01",
  "paid_thru_type": "Bank Transfer",
  "paid_thru_account_name": "Artist Bank Account",
  "send_notification": true
}
```

#### Add Royalty (Admin Only)
```http
POST /api/financial/royalties
Authorization: Bearer <admin-token>

{
  "artist_id": 1,
  "earning_id": 1,
  "release_id": 1,
  "amount": 500.00,
  "description": "50% streaming royalty",
  "date_recorded": "2024-01-31"
}
```

#### Get Financial Summary
```http
GET /api/financial/summary
Authorization: Bearer <token>

# For specific artist
GET /api/financial/summary?artist_id=1
```

**Response:**
```json
{
  "summary": {
    "artist_id": 1,
    "artist_name": "Artist Name",
    "total_royalties": 5000.00,
    "total_payments": 3000.00,
    "current_balance": 2000.00,
    "payout_point": 1000
  }
}
```

#### Add Payment Method
```http
POST /api/financial/payment-methods
Authorization: Bearer <token>

{
  "artist_id": 1,
  "type": "Bank Transfer",
  "account_name": "John Doe",
  "account_number_or_email": "1234567890",
  "bank_code": "BPI",
  "is_default": true
}
```

---

### 🌐 Public API (`/api/public`)

#### Buy Ticket (Public)
```http
POST /api/public/tickets/buy

{
  "event_id": 1,
  "name": "Customer Name",
  "email_address": "customer@example.com",
  "contact_number": "+639123456789",
  "number_of_entries": 1,
  "referrer_code": "FRIEND123",
  "payment_method": "gcash"
}
```

**Response:**
```json
{
  "ticket_code": "XYZ789",
  "checkout_url": "https://checkout.paymongo.com/...",
  "total_amount": 525,
  "message": "Ticket created successfully. Complete payment to confirm."
}
```

#### Verify Ticket (Public)
```http
POST /api/public/tickets/verify

{
  "ticket_code": "XYZ789",
  "event_id": 1
}
```

**Response:**
```json
{
  "valid": true,
  "ticket": {
    "ticket_code": "XYZ789",
    "name": "Customer Name",
    "number_of_entries": 1,
    "status": "Payment Confirmed",
    "event": {
      "title": "Live Concert",
      "date_and_time": "2024-02-15T20:00:00Z",
      "venue": "Music Hall"
    }
  },
  "message": "Ticket is valid"
}
```

#### Get Ticket from Code (Public)
```http
POST /api/public/tickets/get-from-code

{
  "event_id": 1,
  "ticket_code": "XYZ789",
  "verification_pin": "1234"
}
```

#### Check Event PIN (Public)
```http
POST /api/public/tickets/check-pin

{
  "event_id": 1,
  "pin": "1234"
}
```

#### Payment Webhook (PayMongo)
```http
POST /api/public/webhook/payment
Content-Type: application/json
paymongo-signature: <webhook-signature>

{
  "data": {
    "id": "evt_...",
    "type": "event",
    "attributes": {
      "type": "payment.paid",
      "data": {
        "id": "pi_...",
        "type": "payment_intent"
      }
    }
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

---

## Authentication Flow

1. **Login**: POST to `/api/auth/login` with credentials
2. **Get Token**: Store the returned JWT token
3. **Use Token**: Include in Authorization header for protected endpoints
4. **Token Expiry**: Tokens expire in 24 hours, re-login required

---

## PayMongo Integration

The API integrates with PayMongo for payment processing:

1. **Checkout Sessions**: Created for ticket purchases
2. **Payment Links**: Generated for direct payments
3. **Webhooks**: Handle payment confirmations automatically
4. **Fee Calculation**: Automatic processing fee calculation

---

## Multi-tenant Architecture

The API supports multiple brands/labels:

- All data is isolated by `brand_id`
- Users belong to specific brands
- Admin users can manage their brand's data
- Public APIs work across all brands

---

## Email Notifications

Automated emails are sent for:

- Login notifications
- Password reset links
- User invitations
- Payment confirmations
- Ticket confirmations
- Artist profile changes
- Payout notifications

---

## Rate Limiting

Consider implementing rate limiting for:
- Login attempts (brute force protection)
- Public ticket purchases
- Webhook endpoints

---

## Security Features

- JWT-based authentication
- Password hashing (MD5 legacy + bcrypt for new)
- Login attempt tracking
- Admin-only operations protection
- Multi-tenant data isolation
- Webhook signature verification