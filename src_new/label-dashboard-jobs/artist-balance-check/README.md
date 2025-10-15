# Artist Balance Check Lambda Function

This AWS Lambda function automatically checks artist balances that are due for payment and sends an email summary to the superadmin. It connects to the Label Dashboard **System API** to retrieve cross-brand artist payment information and uses SMTP (via nodemailer) to send formatted email reports.

## Features

- Authenticates with the System API using system user credentials
- Fetches artists ready for payment **across all brands** (balance exceeds payout point, has payment method, not on hold)
- Calculates total amount due across all artists
- **Checks Paymongo wallet balance** and compares with total amount due
- **Visual indicators** showing whether wallet balance is sufficient (✓ or ✗)
- **Warning in email subject** if wallet balance is insufficient
- Sends beautifully formatted HTML email summary with brand context
- Includes plain text fallback for email clients that don't support HTML
- Provides detailed logging for monitoring and debugging
- Paginated data fetching for large artist databases

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- Access to the Label Dashboard API with admin credentials
- SMTP server access (e.g., Gmail, SendGrid, AWS SES SMTP, etc.)
- AWS Lambda execution role with basic permissions

## Environment Variables

The Lambda function requires the following environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `API_BASE_URL` | Base URL of the Label Dashboard API | `https://api.meltrecords.com` |
| `API_USERNAME` | System user email address (**must be a system user**) | `system@meltrecords.com` |
| `API_PASSWORD` | System user password | `your-system-user-password` |
| `SUPERADMIN_EMAIL` | Email address to send the summary to | `superadmin@meltrecords.com` |
| `FROM_EMAIL` | Email address to send from | `noreply@meltrecords.com` |
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_SECURE` | Use SSL (set to 'ssl') or TLS (set to 'tls') | `tls` |
| `SMTP_USER` | SMTP authentication username | `your-smtp-username` |
| `SMTP_PASS` | SMTP authentication password | `your-smtp-password` |

**Important**: `API_USERNAME` must be a system user (created with `is_system_user = true` and `brand_id = NULL`). Regular admin users will not work with the System API.

## Installation

1. Navigate to the Lambda function directory:
```bash
cd src_new/label-dashboard-jobs/artist-balance-check
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file for local testing (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Edit `.env` with your actual configuration values

## Building

Compile the TypeScript code to JavaScript:

```bash
npm run build
```

This will create compiled files in the `dist/` directory.

## Local Testing

You can test the Lambda function locally before deploying to AWS:

1. Ensure your `.env` file is configured correctly with valid SMTP credentials
2. Run the test:

```bash
npm run test:local
```

This will:
- Load environment variables from `.env`
- Execute the Lambda handler with mock AWS context
- Fetch artist balances from the API
- Send an actual email via SMTP to the configured superadmin email
- Show detailed console output
- Report execution time and results

**Note**: Local testing will send a real email via your SMTP server, so make sure the `SUPERADMIN_EMAIL` is set to an address you can access.

## Deployment

### SMTP Server Setup

Before deploying, ensure you have valid SMTP credentials. Common options:

1. **Gmail SMTP**:
   - Host: `smtp.gmail.com`, Port: `587`, Secure: `tls`
   - Use an App Password (not your regular Gmail password)
   - Enable 2FA and generate an app-specific password

2. **SendGrid**:
   - Host: `smtp.sendgrid.net`, Port: `587`, Secure: `tls`
   - Use your SendGrid API key as the password
   - Username: `apikey`

3. **AWS SES SMTP**:
   - Host: `email-smtp.{region}.amazonaws.com`, Port: `587`, Secure: `tls`
   - Generate SMTP credentials in SES console
   - Verify sender email in SES

### Manual Deployment

1. Build and package the Lambda function:
```bash
npm run package
```

This creates an `artist-balance-check.zip` file containing the compiled code and dependencies.

2. Create the Lambda function (first time only):
```bash
aws lambda create-function \
  --function-name artist-balance-check \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-artist-balance-check-role \
  --handler dist/index.handler \
  --zip-file fileb://artist-balance-check.zip \
  --timeout 300 \
  --memory-size 256 \
  --environment Variables="{
    API_BASE_URL=https://api.example.com,
    API_USERNAME=admin@example.com,
    API_PASSWORD=your-password,
    SUPERADMIN_EMAIL=superadmin@example.com,
    FROM_EMAIL=noreply@example.com,
    SMTP_HOST=smtp.example.com,
    SMTP_PORT=587,
    SMTP_SECURE=tls,
    SMTP_USER=your-smtp-user,
    SMTP_PASS=your-smtp-password
  }"
```

3. Update existing Lambda function:
```bash
npm run deploy
```

Or manually:
```bash
aws lambda update-function-code \
  --function-name artist-balance-check \
  --zip-file fileb://artist-balance-check.zip
```

### IAM Role Permissions

The Lambda execution role only needs basic logging permissions (no SES permissions required since we use SMTP):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

## Scheduling

To run the balance check automatically, create an EventBridge (CloudWatch Events) rule:

### Daily Schedule (recommended)
```bash
# Create a rule that runs daily at 9 AM UTC (5 PM PHT)
aws events put-rule \
  --name artist-balance-check-daily \
  --schedule-expression "cron(0 9 * * ? *)"

# Add the Lambda function as a target
aws events put-targets \
  --rule artist-balance-check-daily \
  --targets "Id"="1","Arn"="arn:aws:lambda:REGION:ACCOUNT_ID:function:artist-balance-check"

# Grant EventBridge permission to invoke the Lambda
aws lambda add-permission \
  --function-name artist-balance-check \
  --statement-id artist-balance-check-daily \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:REGION:ACCOUNT_ID:rule/artist-balance-check-daily
```

### Weekly Schedule
```bash
# Create a rule that runs every Monday at 9 AM UTC
aws events put-rule \
  --name artist-balance-check-weekly \
  --schedule-expression "cron(0 9 ? * MON *)"
```

### Monthly Schedule
```bash
# Create a rule that runs on the 1st of every month at 9 AM UTC
aws events put-rule \
  --name artist-balance-check-monthly \
  --schedule-expression "cron(0 9 1 * ? *)"
```

## Testing on AWS

### Manual Test Invocation

Invoke the Lambda function manually to test:

```bash
aws lambda invoke \
  --function-name artist-balance-check \
  --payload '{}' \
  response.json

cat response.json
```

### Test from AWS Console

1. Go to Lambda > Functions > artist-balance-check
2. Click the "Test" tab
3. Create a new test event (empty JSON `{}` is fine)
4. Click "Test" to execute
5. Check the execution results and CloudWatch Logs

## Monitoring

Monitor the Lambda function execution through:

- **CloudWatch Logs**: `/aws/lambda/artist-balance-check` log group
- **CloudWatch Metrics**: Invocations, Errors, Duration
- **Lambda Console**: Recent invocations and error rates
- **Email Delivery**: Check your SMTP provider's logs/dashboard for email delivery status

## Email Format

The Lambda sends a professional HTML email with:

- **Header**: Purple gradient banner with title and date
- **Total Amount Due Card**: Green highlighted card showing total amount due and artist count
- **Wallet Balance Card**: Shows Paymongo wallet balance with visual indicators:
  - **Green with ✓ icon** if wallet balance is sufficient for all payments
  - **Red with ✗ icon** if wallet balance is insufficient, showing shortage amount
- **Artists Table**: Detailed breakdown of each artist and their balance with brand context
- **Footer**: Timestamp and automated report notice
- **Email Subject**: Includes ⚠️ warning if wallet balance is insufficient
- **Responsive Design**: Optimized for desktop and mobile email clients
- **Plain Text Fallback**: For email clients that don't support HTML

## How It Works

1. **Authentication**: Authenticates with the System API using system user credentials to obtain a JWT token (expires in 1 hour)
2. **Fetch Balances**: Calls `/api/system/artists-due-payment` with pagination to get **all artists across all brands**
3. **Filter Artists**: System API automatically filters artists where `balance > payout_point`, `has payment method`, and `hold_payouts = false`
4. **Check Wallet Balance**: Calls `/api/system/wallet-balances` to get Paymongo wallet balances for all brands
5. **Compare Balances**: Compares total wallet balance with total amount due to artists
6. **Generate Email**: Creates both HTML and plain text versions of the email with:
   - Total amount due
   - Wallet balance with visual indicator (✓ sufficient / ✗ insufficient)
   - Shortage amount (if insufficient)
   - Artist breakdown by brand
7. **Send Email**: Uses nodemailer with SMTP to send the formatted email to the superadmin
8. **Report**: Returns statistics about the check operation

## API Endpoints Used

The Lambda function uses the System API:

- `POST /api/system/auth/login` - System authentication
- `GET /api/system/artists-due-payment` - Get artists ready for payment (cross-brand, paginated)
- `GET /api/system/wallet-balances` - Get Paymongo wallet balances for all brands

**Authentication request:**
```json
{
  "email": "system@example.com",
  "password": "system-user-password"
}
```

**Authentication response:**
```json
{
  "message": "System login successful",
  "token": "eyJhbGc...",
  "expiresIn": "1h",
  "user": { ... }
}
```

**Artists due payment response:**
```json
{
  "total": 150,
  "page": 1,
  "limit": 100,
  "totalPages": 2,
  "results": [
    {
      "artist_id": 1,
      "artist_name": "Artist Name",
      "brand_id": 2,
      "brand_name": "Label Name",
      "balance": 5000.00,
      "total_royalties": 10000.00,
      "total_payments": 5000.00,
      "payout_point": 1000,
      "hold_payouts": false,
      "last_updated": "2025-10-14T10:30:00.000Z"
    },
    {
      "artist_id": 5,
      "artist_name": "Another Artist",
      "brand_id": 3,
      "brand_name": "Different Label",
      "balance": 2500.00,
      "total_royalties": 3000.00,
      "total_payments": 500.00,
      "payout_point": 1000,
      "hold_payouts": false,
      "last_updated": "2025-10-14T10:30:00.000Z"
    }
  ],
  "filters": {
    "min_balance": 0
  }
}
```

**Note**: The response includes artists from **ALL brands**. Each artist object contains `brand_id` and `brand_name` for context.

## Troubleshooting

### Authentication Fails
- Verify `API_USERNAME` and `API_PASSWORD` are correct
- **Ensure the user is a system user** (`is_system_user = true`, `brand_id = NULL`)
- Check that the API is accessible from Lambda (not behind VPN/firewall)
- Verify the System API is enabled (`ENABLE_SYSTEM_API=true` in API's .env)
- Regular admin users will NOT work - must use system user credentials

### Email Not Sending
- Verify SMTP credentials are correct
- Check SMTP host, port, and secure settings
- Ensure firewall/network allows outbound SMTP connections
- Review CloudWatch Logs for SMTP error messages
- For Gmail, ensure you're using an App Password (not regular password)
- Check your SMTP provider's logs for delivery issues

### API Endpoint Error
- Check the API is running and accessible
- Verify the endpoint `/api/financial/admin/artists-ready-for-payment` exists
- Check CloudWatch Logs for detailed error messages

### Lambda Times Out
- Increase the Lambda timeout (default is 5 minutes, which should be sufficient)
- Check if the API is responding slowly
- Review CloudWatch Logs to see where the timeout occurs

## Important Notes

- **SMTP Configuration**: Ensure your SMTP credentials and settings are correct
- **Network Access**: Lambda must be able to connect to your SMTP server (port 587/465 typically)
- **API Access**: Ensure the Lambda can access the API (consider VPC configuration if API is private)
- **Timezone**: Schedule expressions use UTC time - adjust for your timezone
- **Security**: Store SMTP credentials as Lambda environment variables, never hardcode them

## Future Enhancements

- Add support for multiple superadmin recipients
- Include historical trend data in the email
- Add CSV attachment with detailed breakdown
- Support for custom email templates
- Add Slack/Discord notification options
- Include charts/graphs in the email
- Filter by brand for multi-brand setups
