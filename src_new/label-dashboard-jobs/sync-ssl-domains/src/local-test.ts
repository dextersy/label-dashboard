import { handler } from './index';
import { ScheduledEvent, Context } from 'aws-lambda';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Local test runner for the sync-ssl-domains Lambda function
 *
 * This allows you to test the Lambda function locally without deploying to AWS.
 *
 * Usage:
 * 1. Create a .env file with required environment variables (see .env.example)
 * 2. Run: npm run test:local
 */
async function runLocalTest() {
  console.log('Starting local test of sync-ssl-domains Lambda function...\n');

  // Create mock Lambda event (ScheduledEvent from EventBridge/CloudWatch)
  const mockEvent: ScheduledEvent = {
    version: '0',
    id: 'local-test-' + Date.now(),
    'detail-type': 'Scheduled Event',
    source: 'aws.events',
    account: 'local-test',
    time: new Date().toISOString(),
    region: 'local',
    resources: [],
    detail: {},
  };

  // Create mock Lambda context
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'sync-ssl-domains-local-test',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:local:000000000000:function:sync-ssl-domains-local-test',
    memoryLimitInMB: '512',
    awsRequestId: 'local-test-request-' + Date.now(),
    logGroupName: '/aws/lambda/sync-ssl-domains-local-test',
    logStreamName: new Date().toISOString(),
    getRemainingTimeInMillis: () => 300000, // 5 minutes
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  try {
    // Execute the Lambda handler
    const result = await handler(mockEvent, mockContext, () => {});

    // Ensure result is defined
    if (!result) {
      throw new Error('Handler returned undefined');
    }

    console.log('\n' + '='.repeat(80));
    console.log('LOCAL TEST RESULT');
    console.log('='.repeat(80));
    console.log('Status Code:', result.statusCode);
    console.log('Response Body:');
    console.log(JSON.stringify(JSON.parse(result.body), null, 2));
    console.log('='.repeat(80));

    if (result.statusCode === 200) {
      console.log('\n✓ Test completed successfully!');
      process.exit(0);
    } else if (result.statusCode === 207) {
      console.log('\n⚠ Test completed with warnings/errors');
      process.exit(0);
    } else {
      console.log('\n✗ Test failed');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n' + '='.repeat(80));
    console.error('LOCAL TEST FAILED');
    console.error('='.repeat(80));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(80));
    process.exit(1);
  }
}

// Run the test
runLocalTest();
