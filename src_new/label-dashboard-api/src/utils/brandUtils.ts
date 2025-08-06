import { Domain, Brand } from '../models';

/**
 * Get the frontend URL for a brand by finding its first available domain
 * @param brandId - The brand ID to get the domain for
 * @returns Promise<string> - The full HTTPS URL for the brand's domain
 * @throws Error if no domains are found for the brand
 */
export const getBrandFrontendUrl = async (brandId: number): Promise<string> => {
  // First try to get a verified domain for the brand
  const verifiedDomain = await Domain.findOne({
    where: { 
      brand_id: brandId,
      status: 'Verified'
    }
  });
  
  if (verifiedDomain) {
    return `https://${verifiedDomain.domain_name}`;
  }
  
  // Fallback to any domain if no verified domain exists
  const anyDomain = await Domain.findOne({
    where: { brand_id: brandId }
  });
  
  if (anyDomain) {
    return `https://${anyDomain.domain_name}`;
  }
  
  // Throw error instead of falling back to environment variable
  throw new Error(`No domains found for brand ID ${brandId}`);
};

/**
 * Get brand ID from the requesting domain or referer URL
 * @param domainOrUrl - The domain (e.g., 'example.com') or full URL (e.g., 'https://example.com/path')
 * @returns Promise<number | null> - The brand ID associated with the domain, or null if not found
 */
export const getBrandIdFromDomain = async (domainOrUrl: string): Promise<number | null> => {
  if (!domainOrUrl) {
    return null;
  }

  let cleanDomain: string;

  // Check if it's a full URL (contains protocol)
  if (domainOrUrl.includes('://')) {
    try {
      const url = new URL(domainOrUrl);
      cleanDomain = url.hostname;
    } catch (error) {
      console.error('Invalid URL provided to getBrandIdFromDomain:', domainOrUrl);
      return null;
    }
  } else {
    // It's just a domain, remove port number if present (e.g., 'localhost:4200' -> 'localhost')
    cleanDomain = domainOrUrl.split(':')[0];
  }

  // Find domain record and include brand information
  const domainRecord = await Domain.findOne({
    where: { 
      domain_name: cleanDomain
    },
    include: [{
      model: Brand,
      as: 'brand',
      attributes: ['id']
    }]
  });

  return domainRecord?.brand?.id || null;
};