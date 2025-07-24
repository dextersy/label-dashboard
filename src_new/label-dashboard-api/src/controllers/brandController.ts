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
        as: 'brand'
      }]
    });

    const brand = domainRecord?.brand;

    if (!brand) {
      // Return default brand settings if no brand found
      return res.json({
        id: null,
        name: 'Label Dashboard',
        logo: 'assets/img/default-logo.png',
        color: '#667eea',
        favicon: 'assets/img/default.ico',
        website: cleanDomain
      });
    }

    res.json({
      id: brand.id,
      name: brand.brand_name,
      logo: brand.logo_url || 'assets/img/default-logo.png',
      color: brand.brand_color || '#667eea',
      favicon: 'assets/img/default.ico',
      website: cleanDomain
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
      logo: brand.logo_url,
      color: brand.brand_color,
      favicon: 'assets/img/default.ico',
      website: null
    });

  } catch (error) {
    console.error('Error fetching brand settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};