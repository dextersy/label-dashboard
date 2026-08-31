/**
 * Local testing script for the Task Digest Lambda function
 *
 * Usage:
 * 1. Create a .env file with your configuration (see required vars below)
 * 2. Run: npm run test:local
 */

import { config } from 'dotenv';
import { handler } from './index';
import { Context, ScheduledEvent } from 'aws-lambda';

config();

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'task-digest',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:task-digest',
  memoryLimitInMB: '512',
  awsRequestId: 'mock-request-id',
  logGroupName: '/aws/lambda/task-digest',
  logStreamName: '2024/01/01/[$LATEST]mock-stream',
  getRemainingTimeInMillis: () => 300000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

const mockEvent: ScheduledEvent = {
  version: '0',
  id: 'mock-event-id',
  'detail-type': 'Scheduled Event',
  source: 'aws.events',
  account: '123456789012',
  time: new Date().toISOString(),
  region: 'us-east-1',
  resources: ['arn:aws:events:us-east-1:123456789012:rule/task-digest-daily'],
  detail: {},
};

async function runLocalTest() {
  console.log('========================================');
  console.log('Starting Local Lambda Test — Task Digest');
  console.log('========================================\n');

  console.log('Environment Configuration:');
  console.log(`- API_BASE_URL:  ${process.env.API_BASE_URL || 'NOT SET'}`);
  console.log(`- API_USERNAME:  ${process.env.API_USERNAME || 'NOT SET'}`);
  console.log(`- API_PASSWORD:  ${process.env.API_PASSWORD ? '***' : 'NOT SET'}`);
  console.log(`- FROM_EMAIL:    ${process.env.FROM_EMAIL || 'NOT SET'}`);
  console.log(`- SMTP_HOST:     ${process.env.SMTP_HOST || 'NOT SET'}`);
  console.log(`- SMTP_PORT:     ${process.env.SMTP_PORT || 'NOT SET'}`);
  console.log(`- SMTP_SECURE:   ${process.env.SMTP_SECURE || 'NOT SET'}`);
  console.log(`- SMTP_USER:     ${process.env.SMTP_USER || 'NOT SET'}`);
  console.log(`- SMTP_PASS:     ${process.env.SMTP_PASS ? '***' : 'NOT SET'}\n`);

  const requiredVars = ['API_BASE_URL', 'API_USERNAME', 'API_PASSWORD', 'FROM_EMAIL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missingVars = requiredVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    console.error('❌ ERROR: Missing required environment variables:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.error('\nCreate a .env file in this directory with all required variables.');
    process.exit(1);
  }

  try {
    console.log('Invoking Lambda handler...\n');
    console.log('========================================\n');

    const startTime = Date.now();
    const result = await handler(mockEvent, mockContext, () => {});
    const duration = Date.now() - startTime;

    console.log('\n========================================');
    console.log('Lambda Execution Complete');
    console.log('========================================\n');

    console.log('Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log(`\nExecution Time: ${duration}ms`);

    if (result && result.statusCode === 200) {
      console.log('\n✅ Test completed successfully!');
    } else {
      console.log('\n⚠️ Test completed with errors.');
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

runLocalTest().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
