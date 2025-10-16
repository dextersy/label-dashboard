import { config } from 'dotenv';
import { handler } from './index';

// Load environment variables from .env file
config();

/**
 * Local testing script for Label Balance Check
 *
 * This script simulates AWS Lambda execution locally for testing purposes.
 * It loads environment variables from .env and executes the handler function.
 */

async function runLocalTest() {
  console.log('='.repeat(60));
  console.log('Starting Local Test for Label Balance Check');
  console.log('='.repeat(60));
  console.log('');

  const mockEvent: any = {
    id: 'local-test-event-id',
    time: new Date().toISOString(),
    resources: [],
    'detail-type': 'Scheduled Event',
    source: 'aws.events',
    region: 'local',
    account: '123456789012',
    detail: {}
  };

  const mockContext: any = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'label-balance-check-local',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:local:123456789012:function:label-balance-check-local',
    memoryLimitInMB: '512',
    awsRequestId: 'local-request-id',
    logGroupName: '/aws/lambda/label-balance-check-local',
    logStreamName: new Date().toISOString().replace(/:/g, '-'),
    getRemainingTimeInMillis: () => 300000,
    done: () => {},
    fail: () => {},
    succeed: () => {}
  };

  try {
    const result = await handler(mockEvent, mockContext, () => {});

    console.log('');
    console.log('='.repeat(60));
    console.log('Test Result:');
    console.log('='.repeat(60));

    if (result) {
      console.log('Status Code:', result.statusCode);
      console.log('Body:', JSON.parse(result.body));
    } else {
      console.log('No result returned from handler');
    }

    console.log('');
    console.log('✓ Local test completed successfully');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('✗ Local test failed:');
    console.error('='.repeat(60));
    console.error(error);
    console.error('');

    process.exit(1);
  }
}

runLocalTest();
