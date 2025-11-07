import { LightsailClient, CreateDomainEntryCommand, DomainEntry, CreateDomainEntryRequest } from '@aws-sdk/client-lightsail';

// Lazy-load Lightsail client to ensure environment variables are loaded
let lightsailClient: LightsailClient | null = null;

const getLightsailClient = (): LightsailClient => {
  if (!lightsailClient) {
    if (!process.env.LIGHTSAIL_ACCESS_KEY || !process.env.LIGHTSAIL_SECRET_KEY) {
      throw new Error('Lightsail credentials not configured. Set LIGHTSAIL_ACCESS_KEY and LIGHTSAIL_SECRET_KEY environment variables');
    }
    
    lightsailClient = new LightsailClient({
      credentials: {
        accessKeyId: process.env.LIGHTSAIL_ACCESS_KEY,
        secretAccessKey: process.env.LIGHTSAIL_SECRET_KEY
      },
      region: process.env.LIGHTSAIL_REGION || 'us-east-1'
    });
  }
  return lightsailClient;
};

const getDomainName = (): string => {
  const domain = process.env.LIGHTSAIL_DOMAIN;
  if (!domain) {
    throw new Error('LIGHTSAIL_DOMAIN environment variable is not configured');
  }
  return domain;
};

// Debug function to check environment variables
const debugEnvironmentVariables = (): void => {
  console.log('🔍 DNS Service Environment Variables:');
  console.log('  - LIGHTSAIL_ACCESS_KEY:', process.env.LIGHTSAIL_ACCESS_KEY ? '✅ Set' : '❌ Missing');
  console.log('  - LIGHTSAIL_SECRET_KEY:', process.env.LIGHTSAIL_SECRET_KEY ? '✅ Set' : '❌ Missing');
  console.log('  - LIGHTSAIL_REGION:', process.env.LIGHTSAIL_REGION || 'us-east-1 (default)');
  console.log('  - LIGHTSAIL_DOMAIN:', process.env.LIGHTSAIL_DOMAIN || '❌ Missing (required)');
  console.log('  - FRONTEND_IP:', process.env.FRONTEND_IP || '❌ Missing');
};

/**
 * Create an A record for a subdomain pointing to the frontend IP
 * @param subdomain - The subdomain to create (e.g., 'newlabel')
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export const createSubdomainARecord = async (subdomain: string): Promise<boolean> => {
  try {
    // Debug environment variables first
    debugEnvironmentVariables();
    
    const frontendIP = process.env.FRONTEND_IP;
    
    if (!frontendIP) {
      throw new Error('FRONTEND_IP environment variable is not configured');
    }

    // Validate subdomain format and ensure it's not a full domain
    if (!isValidSubdomain(subdomain)) {
      throw new Error('Invalid subdomain format');
    }
    
    // Ensure subdomain doesn't contain dots (should not be a full domain)
    if (subdomain.includes('.')) {
      throw new Error(`Invalid subdomain: "${subdomain}" appears to be a full domain. Pass only the subdomain part.`);
    }
    
    console.log(`📝 Processing subdomain: "${subdomain}"`);

    // Get the lazy-loaded client (will throw error if credentials not configured)
    const client = getLightsailClient();
    const domainName = getDomainName();

    const domainEntry: DomainEntry = {
      name: `${subdomain}.${domainName}`, // Full subdomain (e.g., 'newlabel.melt-records.com')
      type: 'A',
      target: frontendIP
    };

    const command: CreateDomainEntryRequest = {
      domainName: domainName,
      domainEntry: domainEntry
    };

    console.log(`Creating DNS A record for ${subdomain}.${domainName} pointing to ${frontendIP}`);
    console.log(`🔧 DNS Command Details:`, JSON.stringify(command, null, 2));
    
    const result = await client.send(new CreateDomainEntryCommand(command));
    
    if (result.operation?.status === 'Succeeded' || result.operation?.status === 'Started') {
      console.log(`DNS A record created successfully for ${subdomain}.${domainName}`);
      return true;
    } else {
      console.error(`DNS A record creation failed with status: ${result.operation?.status}`);
      return false;
    }
    
  } catch (error) {
    console.error('Error creating DNS A record:', error);
    
    // Check if it's a duplicate record error (which might be acceptable)
    if (error instanceof Error && error.message.includes('already exists')) {
      console.warn(`DNS record for ${subdomain}.${getDomainName()} already exists`);
      return true; // Consider existing record as success
    }
    
    throw error;
  }
};

/**
 * Validate subdomain format
 * @param subdomain - The subdomain to validate
 * @returns boolean - true if valid, false otherwise
 */
export const isValidSubdomain = (subdomain: string): boolean => {
  // Subdomain should be 1-63 characters, alphanumeric and hyphens only
  // Cannot start or end with hyphen
  const subdomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  return subdomainRegex.test(subdomain);
};

/**
 * Check if subdomain already exists (optional utility function)
 * This could be implemented later if needed for validation
 */
export const subdomainExists = async (subdomain: string): Promise<boolean> => {
  // This would require implementing getDomainEntry functionality
  // For now, we'll rely on the createSubdomainARecord error handling
  return false;
};