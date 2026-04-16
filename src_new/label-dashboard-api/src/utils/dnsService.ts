// DNS provider router — auto-selects Cloudflare or Lightsail based on env vars.
// Set CF_API_TOKEN + CF_ZONE_ID to use Cloudflare; leave them unset to use Lightsail.

export { isValidSubdomain, subdomainExists } from './lightsailDNSService';

export const createSubdomainARecord = async (subdomain: string): Promise<boolean> => {
  if (process.env.CF_API_TOKEN && process.env.CF_ZONE_ID) {
    const cf = await import('./cloudflareDNSService');
    return cf.createSubdomainARecord(subdomain);
  }
  const ls = await import('./lightsailDNSService');
  return ls.createSubdomainARecord(subdomain);
};
