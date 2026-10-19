import * as dotenv from 'dotenv';
dotenv.config();

import { handler } from './index';

(handler({} as any, {} as any, () => {}) as Promise<any>).then((result: any) => {
  console.log('Result:', JSON.stringify(result, null, 2));
}).catch((err: any) => {
  console.error('Error:', err);
  process.exit(1);
});
