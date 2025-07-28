import { Request, Response } from 'express';
import Brand from '../models/Brand';
import Domain from '../models/Domain';

export const getBrandByDomain = async (req: Request, res: Response) => {
  try {
    const domain = req.get('host') || req.headers.origin || req.query.domain as string;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain not provided' });
    }

    // Extract domain from full URL if needed
    let cleanDomain = domain;
    if (domain.includes('://')) {
      cleanDomain = new URL(domain).hostname;
    }
    
    // Remove port if present
    cleanDomain = cleanDomain.split(':')[0];

    // Find domain record first, then get the associated brand
    const domainRecord = await Domain.findOne({
      where: { domain_name: cleanDomain },
      include: [{
        model: Brand,
        as: 'brand',
        attributes: [
          'id', 'brand_name', 'logo_url', 'brand_color', 'brand_website', 
          'favicon_url', 'paymongo_wallet_id', 'payment_processing_fee_for_payouts',
          'release_submission_url', 'catalog_prefix'
        ]
      }]
    });

    const brand = domainRecord?.brand;

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found for this domain' });
    }

    
    res.json({
      domain: cleanDomain,
      brand: {
        id: brand.id,
        name: brand.brand_name,
        logo_url: brand.logo_url,
        brand_color: brand.brand_color || '#667eea',
        brand_website: brand.brand_website,
        favicon_url: brand.favicon_url,
        release_submission_url: brand.release_submission_url,
        catalog_prefix: brand.catalog_prefix || 'REL'
      }
    });

  } catch (error) {
    console.error('Error fetching brand by domain:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBrandSettings = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;

    const brand = await Brand.findByPk(brandId);

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    res.json({
      id: brand.id,
      name: brand.brand_name,
      logo_url: brand.logo_url,
      brand_color: brand.brand_color,
      brand_website: brand.brand_website,
      favicon_url: brand.favicon_url,
      release_submission_url: brand.release_submission_url,
      catalog_prefix: brand.catalog_prefix || 'REL'
    });

  } catch (error) {
    console.error('Error fetching brand settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};