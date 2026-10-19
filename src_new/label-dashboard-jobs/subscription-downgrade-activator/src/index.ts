import { Handler, ScheduledEvent } from 'aws-lambda';
import axios from 'axios';

interface LambdaResponse {
  statusCode: number;
  body: string;
}

interface DowngradeResult {
  brand_id: number;
  status: 'success' | 'error';
  error?: string;
}

interface ProcessDowngradesResponse {
  processed: number;
  succeeded: number;
  failed: number;
  results: DowngradeResult[];
}

class SubscriptionDowngradeActivatorService {
  private apiBaseUrl: string;
  private authToken: string | null = null;

  constructor() {
    const requiredEnvVars = [
      'API_BASE_URL',
      'API_USERNAME',
      'API_PASSWORD',
    ];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }
    this.apiBaseUrl = process.env.API_BASE_URL!;
  }

  private async authenticate(): Promise<void> {
    console.log('Authenticating with System API...');
    const response = await axios.post(`${this.apiBaseUrl}/api/system/auth/login`, {
      email: process.env.API_USERNAME,
      password: process.env.API_PASSWORD,
    });
    if (response.data?.token) {
      this.authToken = response.data.token;
      console.log('Successfully authenticated with System API');
    } else {
      throw new Error('No token received from System API');
    }
  }

  async processPendingDowngrades(): Promise<ProcessDowngradesResponse> {
    if (!this.authToken) {
      await this.authenticate();
    }

    try {
      const response = await axios.post<ProcessDowngradesResponse>(
        `${this.apiBaseUrl}/api/system/process-pending-downgrades`,
        {},
        { headers: { Authorization: `Bearer ${this.authToken}` } }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('Token expired, re-authenticating...');
        await this.authenticate();
        const response = await axios.post<ProcessDowngradesResponse>(
          `${this.apiBaseUrl}/api/system/process-pending-downgrades`,
          {},
          { headers: { Authorization: `Bearer ${this.authToken}` } }
        );
        return response.data;
      }
      throw error;
    }
  }
}

export const handler: Handler<ScheduledEvent, LambdaResponse> = async (event, context) => {
  console.log('Subscription Downgrade Activator Lambda triggered', { event, context });

  try {
    const service = new SubscriptionDowngradeActivatorService();
    const result = await service.processPendingDowngrades();

    console.log(`Processed ${result.processed} pending downgrade(s): ${result.succeeded} succeeded, ${result.failed} failed`);
    if (result.failed > 0) {
      const failures = result.results.filter(r => r.status === 'error');
      console.error('Failed downgrades:', failures);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Subscription downgrade activation completed',
        ...result,
      }),
    };
  } catch (error: any) {
    console.error('Lambda execution failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Subscription downgrade activation failed',
        error: error.message,
      }),
    };
  }
};
