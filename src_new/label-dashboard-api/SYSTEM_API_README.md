# System API Documentation

## Overview

The System API provides brand-independent access to cross-brand data for automated jobs and administrative tasks. System users bypass brand-scoping and can query data across all brands in the system.

## Security Features

### Authentication & Authorization
- **Separate authentication endpoint**: `/api/system/auth/login`
- **System user validation**: Only users with `is_system_user = true` and `brand_id = NULL`
- **Shorter token expiry**: 1 hour (vs 24 hours for regular users)
- **Enhanced audit logging**: All system API calls are logged
- **Rate limiting**: 100 requests per minute
- **Optional IP whitelisting**: Can restrict access by IP in production

### Database Constraints
- System users MUST have `is_system_user = true` AND `brand_id = NULL`
- Regular users MUST have `is_system_user = false` AND `brand_id IS NOT NULL`
- Enforced at both application and database level

## Setup Instructions

### 1. Run Database Migration

```bash
cd src_new/label-dashboard-api
npx sequelize-cli db:migrate --migrations-path migrations --to 20251014000001-add-system-user-support.js
```

This will:
- Add `is_system_user` column to user table
- Make `brand_id` nullable
- Add database constraints
- Add performance indexes

### 2. Create System User

**IMPORTANT**: System users should be created manually in the database, not through the API.

```sql
-- Create a system user
INSERT INTO user (
  email_address,
  password_md5,
  first_name,
  last_name,
  is_admin,
  is_system_user,
  brand_id
) VALUES (
  'system@yourdomain.com',
  MD5('your-secure-password'),
  'System',
  'User',
  1,
  1,
  NULL
);
```

**Security Best Practices for System Users:**
- Use a strong, unique password (min 16 characters)
- Use a dedicated email address (not a personal account)
- Store credentials in a secure password manager
- Rotate passwords regularly
- Consider using API keys instead of passwords for automated jobs

### 3. Environment Configuration

Add these optional environment variables to `.env`:

```env
# System API Configuration
ENABLE_SYSTEM_API=true                    # Enable system API (required in production)
SYSTEM_TOKEN_EXPIRY=1h                    # Token expiry time (default: 1h)

# Optional: IP Whitelisting (comma-separated)
SYSTEM_API_ALLOWED_IPS=192.168.1.100,10.0.0.50

# Existing variables (used by system auth)
JWT_SECRET=your-jwt-secret
FAILED_LOGIN_LIMIT=3
LOCK_TIME_IN_SECONDS=120
```

### 4. Verify Installation

Start the server and check that system endpoints are listed:

```bash
npm run dev
```

You should see:
```
🔧 System API (System Users Only):
   System Login: POST http://localhost:3000/api/system/auth/login
   System Auth Check: GET http://localhost:3000/api/system/auth/me
   ...
```

## API Endpoints

### Authentication

#### Login
```http
POST /api/system/auth/login
Content-Type: application/json

{
  "email": "system@yourdomain.com",
  "password": "your-password"
}
```

**Note**: The `email` field accepts either the user's email address OR username.

**Response:**
```json
{
  "message": "System login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "1h",
  "user": {
    "id": 123,
    "username": "system",
    "email_address": "system@yourdomain.com",
    "first_name": "System",
    "last_name": "User",
    "is_system_user": true
  }
}
```

#### Check Authentication
```http
GET /api/system/auth/me
Authorization: Bearer <token>
```

#### Refresh Token
```http
POST /api/system/auth/refresh
Authorization: Bearer <token>
```

#### Logout
```http
POST /api/system/auth/logout
Authorization: Bearer <token>
```

### Data Access Endpoints

All data endpoints require authentication and return brand context for each record.

#### Get Artists Due for Payment (Cross-Brand)
Returns **ALL artists across ALL brands** who are ready for payment (balance exceeds payout point, has payment method, payouts not on hold).

```http
GET /api/system/artists-due-payment?page=1&limit=50&min_balance=100
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (max: 100, default: 50)
- `min_balance` (optional): Filter artists with balance >= this amount (default: 0)

**Note**: This endpoint returns artists from **all brands**. Brand information is included in each result.

**Response:**
```json
{
  "total": 150,
  "page": 1,
  "limit": 50,
  "totalPages": 3,
  "results": [
    {
      "artist_id": 45,
      "artist_name": "Artist Name",
      "brand_id": 2,
      "brand_name": "Label Name",
      "balance": 1250.50,
      "total_royalties": 5000.00,
      "total_payments": 3749.50,
      "payout_point": 1000,
      "hold_payouts": false,
      "last_updated": "2025-10-14T10:30:00.000Z"
    }
  ],
  "filters": {
    "min_balance": 100
  }
}
```

#### Get Wallet Balances (Cross-Brand)
Returns Paymongo wallet balances for **ALL brands** that have wallets configured.

```http
GET /api/system/wallet-balances
Authorization: Bearer <token>
```

**Response:**
```json
{
  "total_brands": 3,
  "total_balance": 125000.50,
  "wallets": [
    {
      "brand_id": 1,
      "brand_name": "Label Name",
      "wallet_id": "wal_abc123",
      "available_balance": 50000.00,
      "currency": "PHP"
    },
    {
      "brand_id": 2,
      "brand_name": "Another Label",
      "wallet_id": "wal_def456",
      "available_balance": 75000.50,
      "currency": "PHP"
    }
  ],
  "currency": "PHP"
}
```

**Note**: This endpoint fetches real-time wallet balances from Paymongo. Brands without configured wallets are excluded from the results.

#### Get All Brands
```http
GET /api/system/brands?page=1&limit=50
Authorization: Bearer <token>
```

**Response:**
```json
{
  "total": 5,
  "page": 1,
  "limit": 50,
  "totalPages": 1,
  "results": [
    {
      "id": 1,
      "brand_name": "Label Name",
      "domain": "label.example.com",
      "brand_color": "#5fbae9",
      "logo_url": "https://...",
      "status": "active"
    }
  ]
}
```

#### Get All Artists
```http
GET /api/system/artists?page=1&limit=50&brand_id=1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "total": 200,
  "page": 1,
  "limit": 50,
  "totalPages": 4,
  "results": [
    {
      "artist_id": 1,
      "artist_name": "Artist Name",
      "email": "artist@example.com",
      "brand_id": 1,
      "brand_name": "Label Name",
      "status": "active",
      "created_at": "2025-01-15T08:00:00.000Z"
    }
  ]
}
```

#### Get Audit Logs
```http
GET /api/system/audit-logs?limit=100&user_email=system@domain.com&action=SYSTEM_LOGIN
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Max results (max: 1000, default: 100)
- `user_email` (optional): Filter by user email
- `action` (optional): Filter by action type

#### System Health Check
```http
GET /api/system/health
Authorization: Bearer <token>
```

## Usage Examples

### Node.js Example

```javascript
const axios = require('axios');

const SYSTEM_API_URL = 'http://localhost:3000/api/system';
let authToken = null;

// Login
async function systemLogin() {
  const response = await axios.post(`${SYSTEM_API_URL}/auth/login`, {
    email: 'system@yourdomain.com',
    password: 'your-password'
  });

  authToken = response.data.token;
  console.log('System login successful');
  return authToken;
}

// Get artists due for payment
async function getArtistsDuePayment(minBalance = 100) {
  const response = await axios.get(`${SYSTEM_API_URL}/artists-due-payment`, {
    headers: {
      Authorization: `Bearer ${authToken}`
    },
    params: {
      min_balance: minBalance,
      limit: 100
    }
  });

  return response.data.results;
}

// Main function
async function processPayments() {
  try {
    // Login
    await systemLogin();

    // Get artists with balance >= $100
    const artists = await getArtistsDuePayment(100);

    console.log(`Found ${artists.length} artists due for payment`);

    for (const artist of artists) {
      console.log(`${artist.artist_name} (${artist.brand_name}): $${artist.balance}`);
      // Process payment here
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

processPayments();
```

### cURL Examples

```bash
# Login
curl -X POST http://localhost:3000/api/system/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"system@yourdomain.com","password":"your-password"}'

# Get artists due payment
curl -X GET "http://localhost:3000/api/system/artists-due-payment?min_balance=100&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Get all brands
curl -X GET http://localhost:3000/api/system/brands \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Audit Logging

All system API access is logged to `src_new/label-dashboard-api/logs/system-audit.log` with:
- Timestamp
- User ID and email
- Action performed
- Endpoint accessed
- IP addresses (direct and proxy)
- User agent
- Request/response details

**Log format:** JSON lines (one JSON object per line)

**Example log entry:**
```json
{
  "timestamp": "2025-10-14T10:30:00.000Z",
  "userId": 123,
  "userEmail": "system@yourdomain.com",
  "action": "SYSTEM_DATA_READ",
  "endpoint": "/api/system/artists-due-payment",
  "method": "GET",
  "ip": "192.168.1.100",
  "proxyIp": "unknown",
  "userAgent": "axios/1.6.0",
  "requestBody": {
    "resourceType": "artists-due-payment",
    "recordCount": 45,
    "filters": { "min_balance": 100 }
  }
}
```

## Security Checklist

- [ ] Run database migration
- [ ] Create system user with strong password
- [ ] Set `ENABLE_SYSTEM_API=true` in production
- [ ] Configure IP whitelisting (optional but recommended)
- [ ] Set appropriate `SYSTEM_TOKEN_EXPIRY`
- [ ] Store system user credentials securely
- [ ] Monitor audit logs regularly
- [ ] Rotate passwords periodically
- [ ] Review system API access patterns
- [ ] Limit system user accounts (minimum necessary)

## Troubleshooting

### "System API is disabled"
- Set `ENABLE_SYSTEM_API=true` in `.env`

### "Not a valid system user"
- Verify user has `is_system_user = 1` and `brand_id = NULL` in database

### "System user validation failed"
- Check database constraints: `SELECT * FROM user WHERE is_system_user = 1`
- Ensure `brand_id IS NULL` for system users

### "IP not whitelisted"
- Add your IP to `SYSTEM_API_ALLOWED_IPS` in `.env`
- Or remove IP whitelisting in development

### "System token expired"
- Tokens expire after 1 hour by default
- Use `/api/system/auth/refresh` to get a new token
- Or login again

## Best Practices

1. **Minimize System Users**: Only create as many as necessary
2. **Strong Passwords**: Use 16+ character passwords with complexity
3. **Regular Audits**: Review audit logs weekly
4. **Token Management**: Always refresh tokens before expiry
5. **Error Handling**: Implement retry logic with exponential backoff
6. **Rate Limiting**: Stay within 100 requests/minute limit
7. **Pagination**: Always use pagination for large datasets
8. **Monitoring**: Set up alerts for failed login attempts
9. **IP Whitelisting**: Enable in production environments
10. **Principle of Least Privilege**: Grant system access only when necessary
