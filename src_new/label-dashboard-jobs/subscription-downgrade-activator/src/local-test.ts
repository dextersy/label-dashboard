import * as dotenv from 'dotenv';
dotenv.config();

import { handler } from './index';

handler({} as any, {} as any, () => {}).then(result => {
  console.log('Result:', JSON.stringify(result, null, 2));
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
