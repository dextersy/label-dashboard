/**
 * Local testing script for the Release Status Report Lambda function
 *
 * This script allows you to test the Lambda function locally without deploying to AWS.
 *
 * Usage:
 * 1. Create a .env file with your configuration
 * 2. Run: npm run test:local
 */

import { config } from 'dotenv';
import { handler } from './index';
import { Context, ScheduledEvent } from 'aws-lambda';

// Load environment variables from .env file
config();

// Mock Lambda context
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'release-status-report',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:release-status-report',
  memoryLimitInMB: '512',
  awsRequestId: 'mock-request-id',
  logGroupName: '/aws/lambda/release-status-report',
  logStreamName: '2024/01/01/[$LATEST]mock-stream',
  getRemainingTimeInMillis: () => 300000, // 5 minutes
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

// Mock scheduled event (EventBridge/CloudWatch Events)
const mockEvent: ScheduledEvent = {
  version: '0',
  id: 'mock-event-id',
  'detail-type': 'Scheduled Event',
  source: 'aws.events',
  account: '123456789012',
  time: new Date().toISOString(),
  region: 'us-east-1',
  resources: ['arn:aws:events:us-east-1:123456789012:rule/release-status-report-weekly'],
  detail: {},
};

/**
 * Run the Lambda handler locally
 */
async function runLocalTest() {
  console.log('========================================');
  console.log('Starting Local Lambda Test');
  console.log('========================================\n');

  console.log('Environment Configuration:');
  console.log(`- API_BASE_URL: ${process.env.API_BASE_URL || 'NOT SET'}`);
  console.log(`- API_USERNAME: ${process.env.API_USERNAME || 'NOT SET'}`);
  console.log(`- API_PASSWORD: ${process.env.API_PASSWORD ? '***' : 'NOT SET'}`);
  console.log(`- SUPERADMIN_EMAIL: ${process.env.SUPERADMIN_EMAIL || 'NOT SET'}`);
  console.log(`- FROM_EMAIL: ${process.env.FROM_EMAIL || 'NOT SET'}`);
  console.log(`- SMTP_HOST: ${process.env.SMTP_HOST || 'NOT SET'}`);
  console.log(`- SMTP_PORT: ${process.env.SMTP_PORT || 'NOT SET'}`);
  console.log(`- SMTP_SECURE: ${process.env.SMTP_SECURE || 'NOT SET'}`);
  console.log(`- SMTP_USER: ${process.env.SMTP_USER || 'NOT SET'}`);
  console.log(`- SMTP_PASS: ${process.env.SMTP_PASS ? '***' : 'NOT SET'}\n`);

  // Validate required environment variables
  const requiredVars = ['API_BASE_URL', 'API_USERNAME', 'API_PASSWORD', 'SUPERADMIN_EMAIL', 'FROM_EMAIL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('ERROR: Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease create a .env file with all required variables.');
    process.exit(1);
  }

  try {
    console.log('Invoking Lambda handler...\n');
    console.log('========================================\n');

    const startTime = Date.now();

    // Invoke the Lambda handler
    const result = await handler(mockEvent, mockContext, () => {});

    const duration = Date.now() - startTime;

    console.log('\n========================================');
    console.log('Lambda Execution Complete');
    console.log('========================================\n');

    console.log('Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log(`\nExecution Time: ${duration}ms`);

    if (result && result.statusCode === 200) {
      console.log('\nTest completed successfully!');
      console.log('Check the superadmin email inbox for the release status report.');
    } else {
      console.log('\nTest completed with errors.');
    }

  } catch (error: any) {
    console.error('\n========================================');
    console.error('Lambda Execution Failed');
    console.error('========================================\n');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
runLocalTest().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
