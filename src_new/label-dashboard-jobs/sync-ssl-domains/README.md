# SSL Domain Synchronization Lambda

This AWS Lambda function verifies domain DNS records, updates domain status in the database, and removes orphaned domains from the SSL renewal script to prevent SSL renewal failures.

## Quick Start

```bash
# 1. Setup
npm install
cp .env.example .env
# Edit .env with your API credentials

# 2. Test locally
npm run test:local

# 3. Package for deployment
npm run package

# 4. Deploy to Lambda
npm run deploy  # or upload zip manually
```

**Note**: No SSH keys needed! All SSH operations are handled securely by the backend API.

## Problem It Solves

When domains are deleted from the database but remain in the SSL certificate renewal script, Let's Encrypt renewal attempts fail because it tries to validate domains that no longer exist or point to the server. This causes **complete SSL outages for all domains**.

This Lambda function automatically:
- **Verifies DNS records** - Checks that each domain's DNS points to the frontend server
- **Updates database** - Sets domains to 'Unverified' status if DNS doesn't point to frontend
- **Removes orphaned domains** - Removes domains from SSL that aren't in database or don't have valid DNS
- **Does NOT add domains** - New domains must be added manually via admin interface
- **Does NOT trigger immediate renewal** - Just updates the renewal script for next scheduled renewal

## How It Works

The backend API handles all domain verification and SSH operations:

1. **API: Verify DNS** (`/api/system/ssl-domains`) - Backend checks if each domain's DNS points to frontend server
2. **API: Update Database** - Domains with invalid DNS are automatically set to 'Unverified' status
3. **API: Read SSL Certificate** (`/api/system/ssl-cert-domains`) - Backend SSHs to frontend and reads current SSL domains
4. **API: Remove Domains** (`/api/system/ssl-domain/remove`) - Backend SSHs to frontend and removes domains from SSL

The Lambda orchestrates the workflow:

5. **Lambda: Authenticate** - Authenticates with the system API using system user credentials
6. **Lambda: Fetch Verified Domains** - Gets DNS-verified domains from API
7. **Lambda: Fetch SSL Domains** - Gets current SSL certificate domains from API
8. **Lambda: Identify Orphans** - Finds domains that are in SSL but NOT verified by API
9. **Lambda: Remove Orphans** - Calls API to remove each orphaned domain
10. **Lambda: Report** - Logs removed/unverified domains and sends email notifications

### What Happens to the SSL Certificate?

- **Current certificate**: Remains valid and unchanged
- **Removed domains**: Will NOT be included in next scheduled renewal
- **No immediate renewal**: The `--no-renew` flag prevents triggering Let's Encrypt immediately
- **Next renewal**: Will only include domains that are still in the database

### Why Only Remove, Not Add?

**Removal is Safe & Automatic**:
- Orphaned domains cause renewal failures
- Safe to remove immediately (current cert stays valid)
- No user verification needed

**Addition Requires Manual Verification**:
- Domain must be properly configured (DNS, A records)
- User should verify domain before adding to SSL
- Automatic addition could add misconfigured domains
- Safer to require explicit user action via admin interface

**Missing Domains Don't Break Other Domains**:
- If domain A is in SSL but domain B is not:
  - Domain A: Works fine ✅
  - Domain B: Just doesn't have SSL (expected) ⚠️
- No cascade failure, so no urgency to auto-add

## Architecture

```
┌─────────────────────┐
│  AWS Lambda         │
│  (sync-ssl-domains) │
│  - No SSH keys      │
│  - API calls only   │
└──────┬──────────────┘
       │ HTTPS API calls
       │
       v
┌──────────────────────┐
│  Backend API         │
│  (System Endpoints)  │
│                      │
│  - /system/          │
│    ssl-domains       │──┐
│  - /system/          │  │ DNS resolution
│    ssl-cert-domains  │  │
│  - /system/          │  │
│    ssl-domain/remove │  │
└──────┬───────────────┘  │
       │                  │
       │ Database access  │
       │ SSH operations   │
       │                  │
       ├──────────────────┘
       │
       ├──────────────┬──────────────────┐
       v              v                  v
┌──────────┐   ┌──────────┐   ┌──────────────────┐
│ Database │   │   DNS    │   │  Frontend Server │
│ (MySQL)  │   │ Resolver │   │  (SSH access)    │
│          │   │          │   │                  │
│ - domain │   │  Check   │   │ - SSL wrapper    │
│   table  │   │  A       │   │ - remove-ssl-*.sh│
└──────────┘   │  records │   └──────────────────┘
               └──────────┘
```

**Security Benefits:**
- SSH keys stored only on backend API server
- No SSH keys in Lambda deployment package
- No SSH keys in Lambda environment variables
- Centralized SSH access control
- Easier key rotation and management

## Prerequisites

- AWS Lambda execution role with network access to backend API
- Backend API server with:
  - System authentication enabled (`ENABLE_SYSTEM_API=true`)
  - Environment variables configured:
    - `FRONTEND_IP` - IP address of frontend server
    - `SSH_USER` - SSH username (default: bitnami)
    - `SSH_KEY_PATH` - Path to SSH private key on API server
    - `SSL_WRAPPER_PATH` - Path to SSL wrapper script (optional)
    - `REMOVE_SSL_SCRIPT_PATH` - Path to remove domain script (optional)
  - DNS resolution capabilities (for domain verification)
  - SSH access to frontend server
- System user account created in the backend (is_system_user=true, brand_id=NULL)
- Frontend server with:
  - `remove-ssl-domain.sh` script deployed
  - SSH access configured for backend API server

## Environment Variables

### Lambda Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `API_BASE_URL` | Backend API base URL (e.g., https://api.yourdomain.com) | ✅ | - |
| `API_USERNAME` | System user email for API authentication (is_system_user=true, brand_id=NULL) | ✅ | - |
| `API_PASSWORD` | System user password for API authentication | ✅ | - |

**Note**: All SSH configuration, SSL script paths, and frontend IP are now configured on the backend API server, not in the Lambda.

### Backend API Environment Variables

These must be configured on the backend API server (not in Lambda):

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `FRONTEND_IP` | IP address of the frontend server | ✅ | - |
| `SSH_USER` | SSH username for frontend server | ❌ | `bitnami` |
| `SSH_KEY_PATH` | Path to SSH private key on API server | ✅ | - |
| `SSL_WRAPPER_PATH` | Path to SSL wrapper script on frontend | ❌ | `/tmp/ssl-renew-wrapper.sh` |
| `REMOVE_SSL_SCRIPT_PATH` | Path to remove domain script on frontend | ❌ | `/home/bitnami/remove-ssl-domain.sh` |

### Email Notification Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SEND_SUCCESS_NOTIF` | Send email on success (no changes) | ❌ | `false` |
| `SEND_ERROR_NOTIF` | Send email on errors or domain removals | ❌ | `true` |
| `ADMIN_EMAIL` | Admin email address for notifications | ✅* | - |
| `FROM_EMAIL` | Sender email address | ❌ | `noreply@melt-records.com` |
| `SMTP_HOST` | SMTP server hostname | ✅* | - |
| `SMTP_PORT` | SMTP server port | ❌ | `587` |
| `SMTP_SECURE` | Use SSL/TLS (true/false) | ❌ | `false` |
| `SMTP_USER` | SMTP username | ✅* | - |
| `SMTP_PASS` | SMTP password | ✅* | - |

\* Required only if `SEND_SUCCESS_NOTIF` or `SEND_ERROR_NOTIF` is enabled

## Email Notifications

The Lambda can send email notifications to alert administrators about synchronization results.

### Notification Types

**Success Notification** (`SEND_SUCCESS_NOTIF=true`):
- Sent when sync completes with no domains removed and no errors
- Use case: Confirmation that automated cleanup found nothing to remove
- Recommended: `false` (to reduce email noise)

**Error/Removal Notification** (`SEND_ERROR_NOTIF=true`):
- Sent when domains are removed OR errors occur
- Use case: Alert when orphaned domains are cleaned up
- Recommended: `true` (important to know when domains are removed)

### Email Content

**Success Email:**
```
Subject: ✓ SSL Domain Sync - Success (No Changes)
- Orphaned domains removed: 0
- SSL domains before: 5
- SSL domains after: 5
- Errors: 0
```

**Error/Removal Email:**
```
Subject: ⚠️ SSL Domain Sync - 2 Domains Removed
- Orphaned domains removed: 2
- Removed domains list
- SSL domains before: 7
- SSL domains after: 5
- Any errors encountered
```

### SMTP Configuration

**Gmail Example:**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Use App Password, not regular password
```

**AWS SES Example:**
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
```

**Office 365 Example:**
```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@company.com
SMTP_PASS=your-password
```

## Local Development

### Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from template:
```bash
cp .env.example .env
```

3. Fill in your environment variables in `.env`

4. **Add SSH private key** (required for deployment):
```bash
# Copy your SSH key to the keys directory
cp /path/to/your-ssh-key.pem keys/frontend-ssh-key.pem

# Set restrictive permissions
chmod 600 keys/frontend-ssh-key.pem
```

**Important**: The key will be included in the deployment package but excluded from Git.

### Build

```bash
npm run build
```

### Test Locally

```bash
npm run test:local
```

This will:
- Load environment variables from `.env`
- Execute the Lambda handler locally
- Show detailed logs and results

## Deployment

### Package for Lambda

```bash
npm run package
```

This creates `sync-ssl-domains.zip` containing:
- Compiled JavaScript (`dist/`)
- Node modules
- `package.json`

**No SSH keys needed!** All SSH operations are handled by the backend API.

### Deploy to AWS Lambda

#### Option 1: Using AWS CLI

```bash
npm run deploy
```

This assumes you have a Lambda function named `sync-ssl-domains` already created.

#### Option 2: Manual Upload

1. Package the function: `npm run package`
2. Upload `sync-ssl-domains.zip` through AWS Console

### Initial Lambda Setup

Create Lambda function with:

```bash
aws lambda create-function \
  --function-name sync-ssl-domains \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/YOUR_LAMBDA_ROLE \
  --handler index.handler \
  --zip-file fileb://sync-ssl-domains.zip \
  --timeout 900 \
  --memory-size 512
```

### Configure Environment Variables

```bash
aws lambda update-function-configuration \
  --function-name sync-ssl-domains \
  --environment "Variables={
    API_BASE_URL=https://api.yourdomain.com,
    API_USERNAME=system@yourdomain.com,
    API_PASSWORD=your-system-password
  }"
```

**Important**: Make sure the backend API has these environment variables configured:
- `FRONTEND_IP` - IP address of the frontend server
- `SSH_KEY_PATH` - Path to SSH private key on the API server
- `SSH_USER` - SSH username (optional, defaults to 'bitnami')
- `SSL_WRAPPER_PATH` - Path to SSL wrapper script (optional)
- `REMOVE_SSL_SCRIPT_PATH` - Path to remove domain script (optional)

### Schedule the Lambda

Create EventBridge rule to run weekly:

```bash
aws events put-rule \
  --name sync-ssl-domains-weekly \
  --schedule-expression "cron(0 2 ? * SUN *)" \
  --description "Run SSL domain sync every Sunday at 2 AM UTC"

aws events put-targets \
  --rule sync-ssl-domains-weekly \
  --targets "Id"="1","Arn"="arn:aws:lambda:REGION:ACCOUNT:function:sync-ssl-domains"

aws lambda add-permission \
  --function-name sync-ssl-domains \
  --statement-id sync-ssl-domains-weekly \
  --action 'lambda:InvokeFunction' \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:REGION:ACCOUNT:rule/sync-ssl-domains-weekly
```

## Lambda Response Format

### Success (200)

```json
{
  "statusCode": 200,
  "body": {
    "message": "SSL domain synchronization completed successfully",
    "domains_removed": ["old-domain.com", "deleted-domain.com"],
    "domains_added": [],
    "errors": [],
    "ssl_domains_before": 5,
    "ssl_domains_after": 3,
    "db_domains_count": 3
  }
}
```

**Note**:
- `domains_added` is always empty because the Lambda only removes orphaned domains.
- `db_domains_count` represents the number of domains returned from the API (not direct database access).

### Partial Success (207)

```json
{
  "statusCode": 207,
  "body": {
    "message": "SSL domain synchronization completed with errors",
    "domains_removed": ["domain1.com"],
    "domains_added": [],
    "errors": ["Failed to remove domain: domain2.com"],
    "ssl_domains_before": 5,
    "ssl_domains_after": 4,
    "db_domains_count": 3
  }
}
```

### Failure (500)

```json
{
  "statusCode": 500,
  "body": {
    "message": "SSL domain synchronization failed",
    "error": "Database connection failed"
  }
}
```

## Monitoring

### CloudWatch Logs

The function logs to CloudWatch Logs group: `/aws/lambda/sync-ssl-domains`

Key log patterns to watch:
- `SYNCHRONIZATION PLAN` - Shows what will be changed
- `✓` - Successful operations
- `✗` - Failed operations
- `SYNCHRONIZATION COMPLETE` - Final summary

### CloudWatch Metrics

Monitor:
- **Invocation count** - Should match schedule
- **Duration** - Typical: 30-120 seconds
- **Errors** - Should be 0
- **Throttles** - Should be 0

### Alerts

Set up CloudWatch Alarms for:
1. Function errors (threshold: 1)
2. Function duration > 5 minutes
3. Failed invocations

## Troubleshooting

### API Authentication Fails

- Verify `API_BASE_URL` is correct and accessible from Lambda
- Confirm system user credentials (`API_USERNAME` and `API_PASSWORD`) are correct
- Ensure the backend API has `ENABLE_SYSTEM_API=true` set in production
- Check that the system user exists and has `is_system_user=true` in the database
- Verify the system user has `brand_id=NULL` (system users must not be tied to a brand)
- Note: `API_USERNAME` should be the system user's email address

### SSH Connection Fails (Backend API)

If the backend API cannot SSH to the frontend server:

**Check Backend API Configuration:**
- Verify `FRONTEND_IP` is correct
- Verify `SSH_KEY_PATH` points to valid key file on API server
- Verify `SSH_USER` is correct (default: bitnami)
- Check SSH key file permissions: `chmod 600 /path/to/key.pem`
- Verify backend API server can reach frontend: `ping $FRONTEND_IP`

**Check Network Access:**
- Security groups allow SSH (port 22) from API server to frontend
- Frontend server SSH is running and accepting connections
- No firewall blocking SSH between servers

**Test SSH Manually from API Server:**
```bash
ssh -i /path/to/key.pem bitnami@$FRONTEND_IP "echo 'SSH works'"
```

### Domain Add/Remove Fails

- Check that scripts exist on frontend server
- Verify script permissions (should be executable)
- Review script logs on frontend server
- Ensure Let's Encrypt rate limits not exceeded

### Timeout

- Increase Lambda timeout (max 15 minutes)
- Consider processing domains in batches
- Check network latency to frontend server

## Security Considerations

1. **SSH Keys**: Stored only on backend API server, never in Lambda
2. **API Credentials**: Store system user credentials in AWS Secrets Manager
3. **System User**: Ensure system user has minimal required permissions and `brand_id=NULL`
4. **API Authentication**: System API uses JWT tokens with strict validation
5. **IAM Role**: Follow principle of least privilege
6. **Logging**: Ensure sensitive data (API credentials) is not logged
7. **Network**:
   - Lambda only needs HTTPS access to backend API
   - Backend API needs SSH access to frontend server
   - No direct SSH access from Lambda to any server
8. **SSH Key Management**: Centralized on backend API server, easier to rotate and audit

## Cost Estimation

Assuming weekly execution:
- **Lambda**: ~$0.01/month (512MB, 2 min execution)
- **CloudWatch Logs**: ~$0.01/month (1MB logs/week)
- **Total**: **~$0.02/month**

## Related Scripts

- `scripts/add-ssl-domain.sh` - Adds domain to SSL certificate
- `scripts/remove-ssl-domain.sh` - Removes domain from SSL certificate
- `scripts/sync-ssl-domains.sh` - Original bash version (deprecated)

## Support

For issues or questions:
1. Check CloudWatch Logs for detailed error messages
2. Run locally with `npm run test:local` to debug
3. Review frontend server logs for script execution details
