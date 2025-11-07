import * as dotenv from 'dotenv';
import { handler } from './index';

// Load environment variables from .env file
dotenv.config();

// Mock AWS Lambda event and context
const mockEvent: any = {
  id: 'local-test-event',
  'detail-type': 'Scheduled Event',
  source: 'aws.events',
  time: new Date().toISOString(),
  region: process.env.AWS_REGION || 'ap-southeast-1',
};

const mockContext: any = {
  functionName: 's3-cleanup-local-test',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:local:000000000000:function:s3-cleanup-local-test',
  memoryLimitInMB: '256',
  awsRequestId: 'local-test-request-id',
  logGroupName: '/aws/lambda/s3-cleanup-local-test',
  logStreamName: 'local-test-stream',
  getRemainingTimeInMillis: () => 300000, // 5 minutes
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

console.log('==============================================');
console.log('S3 Cleanup Lambda - Local Test');
console.log('==============================================\n');

console.log('Environment Configuration:');
console.log(`API Base URL: ${process.env.API_BASE_URL}`);
console.log(`API Username: ${process.env.API_USERNAME}`);
console.log(`S3 Bucket: ${process.env.AWS_S3_BUCKET}`);
console.log(`Dry Run: ${process.env.DRY_RUN !== 'false' ? 'YES' : 'NO'}`);
console.log(`Min File Age: ${process.env.MIN_FILE_AGE_DAYS || 7} days`);
console.log(`SMTP Host: ${process.env.SMTP_HOST}`);
console.log(`Email To: ${process.env.SUPERADMIN_EMAIL}\n`);

console.log('Starting test execution...\n');

const startTime = Date.now();

handler(mockEvent, mockContext, (error, result) => {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n==============================================');
  console.log('Test Execution Complete');
  console.log('==============================================\n');

  if (error) {
    console.error('❌ Execution failed:');
    console.error(error);
    process.exit(1);
  } else {
    console.log('✅ Execution successful!');
    console.log('\nResult:');
    console.log(JSON.stringify(result, null, 2));
    console.log(`\nExecution time: ${duration} seconds`);
    process.exit(0);
  }
});
