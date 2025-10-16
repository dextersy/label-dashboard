# Label Balance Check - AWS Lambda Job

An automated AWS Lambda function that checks sublabel balances across all brands and sends email notifications to superadmin users.

## Overview

This Lambda function:

1. Authenticates with the System API
2. Fetches all sublabels (child brands) that are ready for payment across all parent brands
3. Calculates balances based on:
   - Music earnings (gross earnings - royalties - platform fees)
   - Event earnings (sales - platform fees)
   - Label payments made
4. Fetches Paymongo wallet balances for all brands
5. Sends a detailed email summary to the superadmin

## Sublabel Payment Readiness Criteria

A sublabel is considered "ready for payment" if:

- **Balance > 0**: The sublabel has a positive balance (music + event earnings - payments made)
- **Parent has payment method**: The parent brand has at least one payment method configured in the Label Payment Methods

## Balance Calculation

For each sublabel, the balance is calculated as:

```
balance = (music_earnings + event_earnings) - label_payments

where:
  music_earnings = gross_earnings - royalties - music_platform_fees
  event_earnings = event_sales - event_platform_fees
  label_payments = sum of all payments made to this sublabel
```

## Email Notification

The email includes:

- **Total amount due** across all sublabels
- **Number of sublabels** ready for payment
- **Paymongo wallet balance** with sufficiency indicator
- **Detailed breakdown** by sublabel with parent brand information
- **Warning** if wallet balance is insufficient

Email format:
- **Subject**: `[label-balance-check] Sublabel Balance Summary - X Sublabels Ready for Payment (₱X,XXX.XX)`
- **From**: Melt Records Dashboard - System Notifications

## Prerequisites

1. **System User**: Create a system user in the database (see System API documentation)
2. **System API Enabled**: Set `ENABLE_SYSTEM_API=true` in the API's `.env`
3. **SMTP Access**: Valid SMTP credentials for sending emails
4. **Database**: Running MySQL database with sublabel data

## Setup

### 1. Install Dependencies

```bash
cd src_new/label-dashboard-jobs/label-balance-check
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required variables:

```env
# System API Configuration
API_BASE_URL=http://localhost:3000
API_USERNAME=system@yourdomain.com
API_PASSWORD=your-system-password

# Email Configuration
SUPERADMIN_EMAIL=admin@yourdomain.com
FROM_EMAIL=noreply@yourdomain.com

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=tls
SMTP_USER=your-smtp-user@gmail.com
SMTP_PASS=your-smtp-password
```

### 3. Build the Project

```bash
npm run build
```

## Local Testing

Test the Lambda function locally before deployment:

```bash
npm run local-test
```

This will:
1. Load environment variables from `.env`
2. Authenticate with the System API
3. Fetch sublabel balances
4. Send test email to the configured superadmin

Expected output:

```
=============================================================
Starting Local Test for Label Balance Check
=============================================================

Authenticating with System API...
Successfully authenticated with System API
Token expires in: 1h

Fetching sublabels ready for payment from System API (cross-brand)...
Fetched page 1 of 1 (3 sublabels ready for payment)
Retrieved 3 total sublabels ready for payment from all brands

Sublabels ready for payment by parent brand:
  - Main Label: 2 sublabels
  - Another Label: 1 sublabel

Total: 3 sublabels ready for payment across 2 parent brands
Total amount due: ₱15000.00

Wallet Balance: ₱20000.00
Sufficient for payments: YES ✓

Sending email summary to admin@yourdomain.com...
Email sent successfully. Message ID: <message-id>

Sublabel balance check completed successfully

=============================================================
Test Result:
=============================================================
Status Code: 200
Body: {
  message: 'Label balance check completed successfully',
  sublabelCount: 3,
  totalAmount: 15000
}

✓ Local test completed successfully
=============================================================
```

## AWS Lambda Deployment

### 1. Package the Function

```bash
npm run deploy
```

This creates `label-balance-check.zip` with:
- Compiled JavaScript code (`dist/`)
- Node modules
- package.json

### 2. Create Lambda Function

```bash
aws lambda create-function \
  --function-name label-balance-check \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler dist/index.handler \
  --zip-file fileb://label-balance-check.zip \
  --timeout 300 \
  --memory-size 512
```

### 3. Configure Environment Variables

```bash
aws lambda update-function-configuration \
  --function-name label-balance-check \
  --environment "Variables={
    API_BASE_URL=https://api.yourdomain.com,
    API_USERNAME=system@yourdomain.com,
    API_PASSWORD=your-system-password,
    SUPERADMIN_EMAIL=admin@yourdomain.com,
    FROM_EMAIL=noreply@yourdomain.com,
    SMTP_HOST=smtp.gmail.com,
    SMTP_PORT=587,
    SMTP_SECURE=tls,
    SMTP_USER=your-smtp-user@gmail.com,
    SMTP_PASS=your-smtp-password
  }"
```

### 4. Set Up CloudWatch Event Rule (Schedule)

Create a daily schedule (e.g., every day at 9 AM):

```bash
aws events put-rule \
  --name label-balance-check-daily \
  --schedule-expression "cron(0 9 * * ? *)"
```

Add Lambda permission for CloudWatch Events:

```bash
aws lambda add-permission \
  --function-name label-balance-check \
  --statement-id label-balance-check-daily-event \
  --action 'lambda:InvokeFunction' \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:REGION:ACCOUNT_ID:rule/label-balance-check-daily
```

Add the Lambda function as the target:

```bash
aws events put-targets \
  --rule label-balance-check-daily \
  --targets "Id"="1","Arn"="arn:aws:lambda:REGION:ACCOUNT_ID:function:label-balance-check"
```

### 5. Update Existing Function

After making code changes:

```bash
npm run deploy
aws lambda update-function-code \
  --function-name label-balance-check \
  --zip-file fileb://label-balance-check.zip
```

## Monitoring

### CloudWatch Logs

View execution logs:

```bash
aws logs tail /aws/lambda/label-balance-check --follow
```

### Manual Invocation

Test the Lambda function manually:

```bash
aws lambda invoke \
  --function-name label-balance-check \
  --payload '{}' \
  response.json

cat response.json
```

### Check Recent Executions

```bash
aws lambda get-function \
  --function-name label-balance-check \
  --query 'Configuration.[LastModified,Runtime,Timeout,MemorySize]'
```

## Troubleshooting

### "System authentication failed"

- Verify `API_BASE_URL` is correct and accessible from Lambda
- Check that system user credentials are valid
- Ensure `ENABLE_SYSTEM_API=true` in the API's environment

### "No sublabels are currently ready for payment"

- Check that sublabels exist in the database with `parent_brand` set
- Verify parent brands have payment methods configured
- Check that sublabels have positive balances

### "Email sending failed"

- Verify SMTP credentials are correct
- Check SMTP_HOST and SMTP_PORT
- For Gmail, enable "Less secure app access" or use App Passwords

### "Wallet balance fetch failed"

- Verify brands have `paymongo_wallet_id` configured
- Check Paymongo API credentials in the API environment
- Ensure PaymentService is properly configured

## System API Endpoint

This job uses the following System API endpoint:

```
GET /api/system/sublabels-due-payment?page=1&limit=100&min_balance=0
```

Response format:

```json
{
  "total": 10,
  "page": 1,
  "limit": 100,
  "totalPages": 1,
  "results": [
    {
      "sublabel_id": 5,
      "sublabel_name": "Sublabel Name",
      "parent_brand_id": 1,
      "parent_brand_name": "Main Label",
      "balance": 5000.00,
      "music_earnings": 3000.00,
      "event_earnings": 2500.00,
      "payments": 500.00,
      "has_payment_method": true,
      "is_ready_for_payment": true,
      "last_updated": "2025-10-16T10:00:00.000Z"
    }
  ],
  "filters": {
    "min_balance": 0
  }
}
```

## Architecture

```
┌─────────────────────┐
│  AWS CloudWatch     │
│  (Scheduled Event)  │
└──────────┬──────────┘
           │ Triggers daily
           ▼
┌─────────────────────┐
│  Lambda Function    │
│  label-balance      │
│  -check             │
└──────────┬──────────┘
           │
           ├─────────► System API (Authenticate)
           │
           ├─────────► System API (Get Sublabels Due Payment)
           │
           ├─────────► System API (Get Wallet Balances)
           │
           └─────────► SMTP Server (Send Email)
```

## Security Considerations

1. **System User Credentials**: Store in AWS Secrets Manager in production
2. **SMTP Credentials**: Use AWS SES or store credentials securely
3. **API Access**: Ensure System API is only accessible from trusted sources
4. **Token Expiry**: System API tokens expire after 1 hour (handled automatically)
5. **Rate Limiting**: System API has rate limits (100 requests/minute)

## Related Documentation

- [System API Documentation](../../label-dashboard-api/SYSTEM_API_README.md)
- [Artist Balance Check Job](../artist-balance-check/README.md)
- [Label Payment Methods](../../label-dashboard-api/API.md#label-payment-methods)

## Support

For issues or questions:
1. Check CloudWatch Logs for error details
2. Verify environment variables are correct
3. Test locally using `npm run local-test`
4. Review System API audit logs for authentication issues
