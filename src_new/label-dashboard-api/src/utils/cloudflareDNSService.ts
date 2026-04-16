import * as https from 'https';

const getConfig = (): { apiToken: string; zoneId: string; domain: string; frontendIP: string } => {
  const apiToken = process.env.CF_API_TOKEN;
  const zoneId = process.env.CF_ZONE_ID;
  const domain = process.env.LIGHTSAIL_DOMAIN;
  const frontendIP = process.env.FRONTEND_IP;

  if (!apiToken) throw new Error('CF_API_TOKEN environment variable is not configured');
  if (!zoneId) throw new Error('CF_ZONE_ID environment variable is not configured');
  if (!domain) throw new Error('LIGHTSAIL_DOMAIN environment variable is not configured');
  if (!frontendIP) throw new Error('FRONTEND_IP environment variable is not configured');

  return { apiToken, zoneId, domain, frontendIP };
};

const cfRequest = <T>(method: string, path: string, apiToken: string, body?: object): Promise<T> => {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const options: https.RequestOptions = {
      hostname: 'api.cloudflare.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data) as T);
        } catch {
          reject(new Error(`Failed to parse Cloudflare response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
};

interface CFResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result?: object;
}

/**
 * Create an A record for a subdomain pointing to the frontend IP
 * @param subdomain - The subdomain to create (e.g., 'newlabel')
 * @returns Promise<boolean> - true if successful
 */
export const createSubdomainARecord = async (subdomain: string): Promise<boolean> => {
  if (!isValidSubdomain(subdomain)) {
    throw new Error('Invalid subdomain format');
  }
  if (subdomain.includes('.')) {
    throw new Error(`Invalid subdomain: "${subdomain}" appears to be a full domain. Pass only the subdomain part.`);
  }

  const { apiToken, zoneId, domain, frontendIP } = getConfig();
  const fullName = `${subdomain}.${domain}`;

  console.log(`Creating Cloudflare DNS A record for ${fullName} pointing to ${frontendIP}`);

  const response = await cfRequest<CFResponse>(
    'POST',
    `/client/v4/zones/${zoneId}/dns_records`,
    apiToken,
    { type: 'A', name: fullName, content: frontendIP, proxied: false, ttl: 1 }
  );

  if (response.success) {
    console.log(`Cloudflare DNS A record created successfully for ${fullName}`);
    return true;
  }

  // Code 81057 = record already exists
  const alreadyExists = response.errors.some(
    (e) => e.code === 81057 || e.message.toLowerCase().includes('already exists')
  );
  if (alreadyExists) {
    console.warn(`Cloudflare DNS record for ${fullName} already exists`);
    return true;
  }

  throw new Error(`Cloudflare API error: ${JSON.stringify(response.errors)}`);
};

/**
 * Validate subdomain format
 */
export const isValidSubdomain = (subdomain: string): boolean => {
  const subdomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  return subdomainRegex.test(subdomain);
};

/**
 * Check if subdomain already exists in Cloudflare
 */
export const subdomainExists = async (subdomain: string): Promise<boolean> => {
  const { apiToken, zoneId, domain } = getConfig();
  const fullName = `${subdomain}.${domain}`;

  interface CFListResponse {
    success: boolean;
    result: Array<{ name: string }>;
  }

  const response = await cfRequest<CFListResponse>(
    'GET',
    `/client/v4/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(fullName)}`,
    apiToken
  );

  return response.success && response.result.length > 0;
};
