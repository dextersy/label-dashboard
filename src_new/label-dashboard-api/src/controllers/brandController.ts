import { Request, Response } from 'express';
import Brand from '../models/Brand';
import Domain from '../models/Domain';
import multer from 'multer';
import path from 'path';
import AWS from 'aws-sdk';
import pngToIco from 'png-to-ico';

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
      catalog_prefix: brand.catalog_prefix || 'REL',
      payment_processing_fee_for_payouts: brand.payment_processing_fee_for_payouts || 0
    });

  } catch (error) {
    console.error('Error fetching brand settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateBrandSettings = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const {
      name,
      brand_website,
      brand_color,
      catalog_prefix,
      release_submission_url,
      payment_processing_fee_for_payouts
    } = req.body;

    const brand = await Brand.findByPk(brandId);

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Update brand settings
    await brand.update({
      brand_name: name,
      brand_website: brand_website || null,
      brand_color: brand_color || brand.brand_color,
      catalog_prefix: catalog_prefix || brand.catalog_prefix,
      release_submission_url: release_submission_url || null,
      payment_processing_fee_for_payouts: payment_processing_fee_for_payouts || 0
    });

    res.json({
      message: 'Brand settings updated successfully',
      brand: {
        id: brand.id,
        name: brand.brand_name,
        logo_url: brand.logo_url,
        brand_color: brand.brand_color,
        brand_website: brand.brand_website,
        favicon_url: brand.favicon_url,
        release_submission_url: brand.release_submission_url,
        catalog_prefix: brand.catalog_prefix,
        payment_processing_fee_for_payouts: brand.payment_processing_fee_for_payouts
      }
    });

  } catch (error) {
    console.error('Error updating brand settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Configure AWS S3
AWS.config.update({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: process.env.S3_REGION
});

const s3 = new AWS.S3();

// Configure multer for memory storage (for S3 upload)
const storage = multer.memoryStorage();

const logoFileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Logo must be a JPG or PNG file'));
  }
};

const faviconFileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Favicon must be a PNG file'));
  }
};

const logoUpload = multer({
  storage: storage,
  fileFilter: logoFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

const faviconUpload = multer({
  storage: storage,
  fileFilter: faviconFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

export const uploadLogo = [
  logoUpload.single('logo'),
  async (req: Request, res: Response) => {
    try {
      const { brandId } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const brand = await Brand.findByPk(brandId);
      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      // Generate unique filename for S3
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(req.file.originalname);
      const fileName = `brand-logo-${brandId}-${uniqueSuffix}${extension}`;

      try {
        // Upload to S3
        const uploadParams = {
          Bucket: process.env.S3_BUCKET!,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        };

        const result = await s3.upload(uploadParams).promise();

        // Delete old logo from S3 if it exists
        if (brand.logo_url && brand.logo_url.startsWith('https://')) {
          try {
            const oldUrl = new URL(brand.logo_url);
            const oldKey = oldUrl.pathname.substring(1);
            
            await s3.deleteObject({
              Bucket: process.env.S3_BUCKET!,
              Key: oldKey
            }).promise();
          } catch (deleteError) {
            console.error('Error deleting old logo:', deleteError);
          }
        }

        // Update brand with new logo URL
        await brand.update({ logo_url: result.Location });

        res.json({
          message: 'Logo uploaded successfully',
          logo_url: result.Location
        });

      } catch (uploadError) {
        console.error('S3 upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload logo to S3' });
      }

    } catch (error) {
      console.error('Error uploading logo:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
];

export const uploadFavicon = [
  faviconUpload.single('favicon'),
  async (req: Request, res: Response) => {
    try {
      const { brandId } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const brand = await Brand.findByPk(brandId);
      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      // Generate unique filename for ICO file
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileName = `brand-favicon-${brandId}-${uniqueSuffix}.ico`;

      try {
        // Convert PNG to ICO using png-to-ico
        const icoBuffer = await pngToIco(req.file.buffer);

        // Upload ICO to S3
        const uploadParams = {
          Bucket: process.env.S3_BUCKET!,
          Key: fileName,
          Body: icoBuffer,
          ContentType: 'image/x-icon'
        };

        const result = await s3.upload(uploadParams).promise();

        // Delete old favicon from S3 if it exists
        if (brand.favicon_url && brand.favicon_url.startsWith('https://')) {
          try {
            const oldUrl = new URL(brand.favicon_url);
            const oldKey = oldUrl.pathname.substring(1);
            
            await s3.deleteObject({
              Bucket: process.env.S3_BUCKET!,
              Key: oldKey
            }).promise();
          } catch (deleteError) {
            console.error('Error deleting old favicon:', deleteError);
          }
        }

        // Update brand with new favicon URL
        await brand.update({ favicon_url: result.Location });

        res.json({
          message: 'Favicon uploaded successfully',
          favicon_url: result.Location
        });

      } catch (conversionError) {
        console.error('PNG to ICO conversion error:', conversionError);
        return res.status(500).json({ error: 'Failed to convert PNG to ICO format' });
      }

    } catch (error) {
      console.error('Error uploading favicon:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
];