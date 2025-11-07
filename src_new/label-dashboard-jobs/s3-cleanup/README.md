# S3 Cleanup Lambda Function

This AWS Lambda function automatically cleans up unused files in an S3 bucket by comparing file URLs stored in the database against actual files in S3. It connects to the Label Dashboard **System API** to retrieve all used URLs across all brands and uses AWS SDK to manage S3 operations.

## Features

- Authenticates with the System API using system user credentials
- Fetches all used URLs/paths from database **across all brands** (cross-brand operation)
- Lists all files in the specified S3 bucket
- Identifies unused files by comparing S3 files with database URLs
- **Dry run mode** by default - only reports what would be deleted
- **Minimum file age safety** - only deletes files older than specified days
- Batch deletion for efficient S3 operations
- Sends detailed HTML email summary with cleanup results
- Comprehensive error handling and logging
- Supports various URL formats (full S3 URLs, relative paths, etc.)

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- Access to the Label Dashboard API with system user credentials
- SMTP server access for email notifications
- AWS Lambda execution role with S3 and CloudWatch permissions

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
| `SMTP_SECURE` | Use SSL (`ssl`) or TLS (`tls`) | `tls` |
| `SMTP_USER` | SMTP authentication username | `your-smtp-username` |
| `SMTP_PASS` | SMTP authentication password | `your-smtp-password` |
| `AWS_S3_BUCKET` | S3 bucket name to clean up | `melt-records-uploads` |
| `AWS_REGION` | AWS region | `ap-southeast-1` |
| `DRY_RUN` | If `true`, only report (don't delete). If `false`, actually delete files | `true` |
| `MIN_FILE_AGE_DAYS` | Minimum file age in days before considering for deletion | `7` |

**Important**:
- `API_USERNAME` must be a system user (created with `is_system_user = true` and `brand_id = NULL`)
- Regular admin users will not work with the System API
- Set `DRY_RUN=false` only after verifying the cleanup list in dry run mode

## Installation

1. Navigate to the Lambda function directory:
```bash
cd src_new/label-dashboard-jobs/s3-cleanup
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

1. Ensure your `.env` file is configured correctly
2. **IMPORTANT**: Keep `DRY_RUN=true` for initial testing
3. Run the test:

```bash
npm run test:local
```

This will:
- Load environment variables from `.env`
- Execute the Lambda handler with mock AWS context
- Fetch used URLs from the System API
- List all files in S3
- Identify unused files
- Send an actual email via SMTP to the configured superadmin email
- Show detailed console output with results
- Report execution time

**Note**: Local testing will send a real email via your SMTP server. Make sure the `SUPERADMIN_EMAIL` is set to an address you can access.

## Deployment

### IAM Role Permissions

The Lambda execution role needs these permissions:

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
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

### Manual Deployment

1. Build and package the Lambda function:
```bash
npm run package
```

This creates an `s3-cleanup.zip` file containing the compiled code and dependencies.

2. Create the Lambda function (first time only):
```bash
aws lambda create-function \
  --function-name s3-cleanup \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-s3-cleanup-role \
  --handler dist/index.handler \
  --zip-file fileb://s3-cleanup.zip \
  --timeout 900 \
  --memory-size 512 \
  --environment Variables="{
    API_BASE_URL=https://api.example.com,
    API_USERNAME=system@example.com,
    API_PASSWORD=your-password,
    SUPERADMIN_EMAIL=superadmin@example.com,
    FROM_EMAIL=noreply@example.com,
    SMTP_HOST=smtp.gmail.com,
    SMTP_PORT=587,
    SMTP_SECURE=tls,
    SMTP_USER=your-smtp-user,
    SMTP_PASS=your-smtp-password,
    AWS_S3_BUCKET=your-bucket-name,
    AWS_REGION=ap-southeast-1,
    DRY_RUN=true,
    MIN_FILE_AGE_DAYS=7
  }"
```

3. Update existing Lambda function:
```bash
npm run deploy
```

Or manually:
```bash
aws lambda update-function-code \
  --function-name s3-cleanup \
  --zip-file fileb://s3-cleanup.zip
```

## Scheduling

To run the cleanup automatically, create an EventBridge (CloudWatch Events) rule:

### Weekly Schedule (recommended for initial testing)
```bash
# Create a rule that runs every Sunday at 2 AM UTC
aws events put-rule \
  --name s3-cleanup-weekly \
  --schedule-expression "cron(0 2 ? * SUN *)"

# Add the Lambda function as a target
aws events put-targets \
  --rule s3-cleanup-weekly \
  --targets "Id"="1","Arn"="arn:aws:lambda:REGION:ACCOUNT_ID:function:s3-cleanup"

# Grant EventBridge permission to invoke the Lambda
aws lambda add-permission \
  --function-name s3-cleanup \
  --statement-id s3-cleanup-weekly \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:REGION:ACCOUNT_ID:rule/s3-cleanup-weekly
```

### Monthly Schedule (recommended for production)
```bash
# Create a rule that runs on the 1st of every month at 2 AM UTC
aws events put-rule \
  --name s3-cleanup-monthly \
  --schedule-expression "cron(0 2 1 * ? *)"
```

## Testing on AWS

### Manual Test Invocation

Invoke the Lambda function manually to test:

```bash
aws lambda invoke \
  --function-name s3-cleanup \
  --payload '{}' \
  response.json

cat response.json
```

### Test from AWS Console

1. Go to Lambda > Functions > s3-cleanup
2. Click the "Test" tab
3. Create a new test event (empty JSON `{}` is fine)
4. Click "Test" to execute
5. Check the execution results and CloudWatch Logs

## Monitoring

Monitor the Lambda function execution through:

- **CloudWatch Logs**: `/aws/lambda/s3-cleanup` log group
- **CloudWatch Metrics**: Invocations, Errors, Duration
- **Lambda Console**: Recent invocations and error rates
- **Email Reports**: Check your SMTP provider's logs/dashboard for email delivery status

## Email Format

The Lambda sends a professional HTML email with:

- **Header**: Purple gradient banner with title, date, and dry run indicator
- **Summary Cards**:
  - Files scanned
  - Files in use
  - Unused files (to delete / deleted)
  - Space freed (in MB)
- **Error Section**: Shows any errors encountered during cleanup (if any)
- **Files List**: Detailed table of unused files with:
  - File path/key
  - File size
  - File age (in days)
  - Up to 50 files shown, with count of additional files
- **Footer**: Bucket name, minimum file age, timestamp
- **Visual Indicators**: Colors and icons show status (dry run vs actual deletion)
- **Responsive Design**: Optimized for desktop and mobile email clients
- **Plain Text Fallback**: For email clients that don't support HTML

## How It Works

1. **Authentication**: Authenticates with the System API using system user credentials to obtain a JWT token (expires in 1 hour)
2. **Fetch Used URLs**: Calls `/api/system/s3-used-urls` to get all file URLs stored in the database across all brands
3. **Extract S3 Keys**: Extracts S3 keys from various URL formats (full URLs, relative paths, etc.)
4. **List S3 Files**: Lists all files in the specified S3 bucket using AWS SDK
5. **Compare**: Compares S3 files with database URLs to identify unused files
6. **Apply Safety Rules**:
   - Skip files newer than `MIN_FILE_AGE_DAYS`
   - Only process files older than the threshold
7. **Delete (if not dry run)**: Deletes unused files in batches of 1000 (S3 limit)
8. **Generate Report**: Creates detailed summary with statistics
9. **Send Email**: Uses nodemailer with SMTP to send the formatted email to the superadmin
10. **Return**: Returns statistics about the cleanup operation

## API Endpoints Used

The Lambda function uses the System API:

- `POST /api/system/auth/login` - System authentication
- `GET /api/system/s3-used-urls` - Get all URLs used in database (cross-brand)

**Authentication request:**
```json
{
  "email": "system@example.com",
  "password": "system-user-password"
}
```

**Used URLs response:**
```json
{
  "total_urls": 1523,
  "urls": [
    "https://bucket.s3.region.amazonaws.com/path/to/file1.jpg",
    "/uploads/artist-images/file2.png",
    "s3://bucket/documents/file3.pdf",
    ...
  ],
  "breakdown": {
    "brands": 5,
    "events": 42,
    "artists": 156,
    "artist_images": 987,
    "artist_documents": 333
  }
}
```

**Note**: The System API checks these models for URLs:
- **Brand**: logo_url, favicon_url, release_submission_url
- **Event**: poster_url, venue_maps_url
- **Artist**: website_page_url
- **ArtistImage**: path
- **ArtistDocument**: path

## Safety Features

1. **Dry Run Mode**: Default behavior - reports what would be deleted without actually deleting
2. **Minimum File Age**: Only considers files older than specified days (default: 7 days)
3. **Email Notification**: Always sends report before and after cleanup
4. **Error Handling**: Continues cleanup even if individual file deletions fail
5. **Batch Processing**: Deletes in batches to handle large numbers of files efficiently
6. **Cross-Brand Verification**: Checks URLs across all brands to ensure no active file is deleted

## Recommended Workflow

### Phase 1: Testing (Dry Run)
1. Deploy with `DRY_RUN=true`
2. Set `MIN_FILE_AGE_DAYS=30` for conservative testing
3. Run manually and review email report
4. Verify that no active files are marked for deletion

### Phase 2: Small Batch Test
1. Set `MIN_FILE_AGE_DAYS=30`
2. Set `DRY_RUN=false`
3. Run manually and monitor results
4. Verify application still works (no broken images/files)

### Phase 3: Production
1. Set `MIN_FILE_AGE_DAYS=7` (or your preferred value)
2. Set `DRY_RUN=false`
3. Schedule monthly automatic cleanup
4. Monitor email reports regularly

## Troubleshooting

### Authentication Fails
- Verify `API_USERNAME` and `API_PASSWORD` are correct
- **Ensure the user is a system user** (`is_system_user = true`, `brand_id = NULL`)
- Check that the API is accessible from Lambda
- Verify the System API is enabled (`ENABLE_SYSTEM_API=true` in API's .env)
- Regular admin users will NOT work - must use system user credentials

### S3 Access Denied
- Verify Lambda execution role has S3 permissions
- Check bucket name is correct
- Ensure bucket policy allows Lambda access
- Verify AWS region is correct

### Files Not Being Deleted
- Check if `DRY_RUN=true` (dry run mode)
- Verify files are older than `MIN_FILE_AGE_DAYS`
- Check CloudWatch Logs for specific errors
- Ensure file URLs in database match S3 keys

### Email Not Sending
- Verify SMTP credentials are correct
- Check SMTP host, port, and secure settings
- Ensure firewall/network allows outbound SMTP connections
- Review CloudWatch Logs for SMTP error messages

### Lambda Times Out
- Increase Lambda timeout (default is 15 minutes)
- Consider running cleanup in smaller batches
- Check if bucket has extremely large number of files
- Review CloudWatch Logs to see where timeout occurs

## Important Notes

- **Always test with DRY_RUN=true first!**
- **Verify email reports before setting DRY_RUN=false**
- Lambda must be able to access both the API and SMTP server
- Consider VPC configuration if API or SMTP is private
- Schedule expressions use UTC time - adjust for your timezone
- Store credentials as Lambda environment variables, never hardcode them
- Monitor cleanup reports regularly to catch issues early
- Keep MIN_FILE_AGE_DAYS reasonably high (7+ days) for safety

## Future Enhancements

- Add support for multiple S3 buckets
- Include file type statistics in report
- Add CSV export of deleted files
- Support for archiving instead of deleting
- Integration with AWS S3 Glacier for old files
- Slack/Discord notification options
- Whitelist/blacklist patterns for files to keep/delete
- Per-brand cleanup statistics

## Security Considerations

- Lambda execution role follows principle of least privilege
- System user credentials stored as environment variables
- Audit logging tracks all cleanup operations
- Email reports provide transparency
- Dry run mode prevents accidental deletions
- Minimum file age provides additional safety buffer
