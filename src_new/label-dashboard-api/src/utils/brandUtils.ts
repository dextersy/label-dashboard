import { Domain } from '../models';

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