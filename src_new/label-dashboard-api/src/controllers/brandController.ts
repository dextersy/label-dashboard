import { Request, Response } from 'express';
import Brand from '../models/Brand';
import Domain from '../models/Domain';
import User from '../models/User';
import { Earning, Royalty, Ticket, Event, Release } from '../models';
import { Op, literal } from 'sequelize';
import multer from 'multer';
import path from 'path';
import AWS from 'aws-sdk';
import pngToIco from 'png-to-ico';
import dns from 'dns';
import { promisify } from 'util';
import https from 'https';

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
      paymongo_wallet_id: brand.paymongo_wallet_id,
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
      paymongo_wallet_id,
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
      paymongo_wallet_id: paymongo_wallet_id || null,
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
        paymongo_wallet_id: brand.paymongo_wallet_id,
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

// Domain Management Functions

export const getDomains = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;

    const domains = await Domain.findAll({
      where: { brand_id: brandId },
      attributes: ['domain_name', 'status', 'brand_id']
    });

    res.json(domains);

  } catch (error) {
    console.error('Error fetching domains:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addDomain = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { domain_name } = req.body;

    if (!domain_name) {
      return res.status(400).json({ error: 'Domain name is required' });
    }

    // Validate domain name format
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain_name)) {
      return res.status(400).json({ error: 'Invalid domain name format' });
    }

    // Check if brand exists
    const brand = await Brand.findByPk(brandId);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Check if domain already exists
    const existingDomain = await Domain.findOne({
      where: { domain_name }
    });

    if (existingDomain) {
      return res.status(409).json({ error: 'Domain already exists' });
    }

    // Create new domain
    const newDomain = await Domain.create({
      brand_id: parseInt(brandId),
      domain_name: domain_name.toLowerCase().trim(),
      status: 'Unverified'
    });

    res.status(201).json({
      message: 'Domain added successfully',
      domain: {
        domain_name: newDomain.domain_name,
        status: newDomain.status,
        brand_id: newDomain.brand_id
      }
    });

  } catch (error) {
    console.error('Error adding domain:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteDomain = async (req: Request, res: Response) => {
  try {
    const { brandId, domainName } = req.params;

    // Check if brand exists
    const brand = await Brand.findByPk(brandId);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Find the domain
    const domain = await Domain.findOne({
      where: {
        brand_id: brandId,
        domain_name: domainName
      }
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Delete the domain
    await domain.destroy();

    res.json({
      message: 'Domain deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting domain:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const dnsResolve4 = promisify(dns.resolve4);

// Cache for server IP (valid for 1 hour)
let serverIPCache: { ip: string; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Function to get server's public IP address dynamically
const getServerPublicIP = async (): Promise<string> => {
  // Check cache first
  if (serverIPCache && (Date.now() - serverIPCache.timestamp) < CACHE_DURATION) {
    console.log(`Using cached server IP: ${serverIPCache.ip}`);
    return serverIPCache.ip;
  }

  return new Promise((resolve, reject) => {
    // Try multiple IP detection services for reliability
    const ipServices = [
      'https://api.ipify.org',
      'https://ipinfo.io/ip',
      'https://icanhazip.com'
    ];

    let attempts = 0;
    const tryService = (serviceIndex: number) => {
      if (serviceIndex >= ipServices.length) {
        reject(new Error('Unable to determine server public IP from any service'));
        return;
      }

      const url = ipServices[serviceIndex];
      console.log(`Attempting to get server IP from: ${url}`);

      const request = https.get(url, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          const ip = data.trim();
          // Validate IP format
          const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
          if (ipRegex.test(ip)) {
            console.log(`Server public IP detected: ${ip}`);
            // Cache the IP
            serverIPCache = { ip, timestamp: Date.now() };
            resolve(ip);
          } else {
            console.warn(`Invalid IP format from ${url}: ${ip}`);
            tryService(serviceIndex + 1);
          }
        });
      });

      request.on('error', (error) => {
        console.warn(`Error getting IP from ${url}:`, error.message);
        tryService(serviceIndex + 1);
      });

      // Set timeout for each request
      request.setTimeout(5000, () => {
        request.destroy();
        console.warn(`Timeout getting IP from ${url}`);
        tryService(serviceIndex + 1);
      });
    };

    tryService(0);
  });
};

export const verifyDomain = async (req: Request, res: Response) => {
  try {
    const { brandId, domainName } = req.params;

    // Check if brand exists
    const brand = await Brand.findByPk(brandId);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Find the domain
    const domain = await Domain.findOne({
      where: {
        brand_id: brandId,
        domain_name: domainName
      }
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    try {
      // Get server's public IP dynamically
      console.log('Getting server public IP...');
      const serverIP = await getServerPublicIP();
      console.log(`Verifying domain ${domainName} against server IP ${serverIP}`);
      
      // Resolve domain's A record
      const addresses = await dnsResolve4(domainName);
      console.log(`Domain ${domainName} resolves to:`, addresses);
      
      // Check if any of the resolved addresses match our server IP
      const isVerified = addresses.some(addr => addr === serverIP);
      console.log(`Domain verification result: ${isVerified ? 'VERIFIED' : 'FAILED'}`);
      
      // Update domain status - either Verified or Unverified
      const newStatus = isVerified ? 'Verified' : 'Unverified';
      await domain.update({ status: newStatus });

      if (isVerified) {
        res.json({
          message: 'Domain verified successfully',
          status: 'Verified'
        });
      } else {
        res.status(400).json({
          error: 'Domain verification failed. Domain does not point to our server.',
          status: 'Unverified',
          serverIP,
          resolvedIPs: addresses,
          hint: `Please update your domain's A record to point to ${serverIP}`
        });
      }

    } catch (error: any) {
      console.error(`Error during domain verification for ${domainName}:`, error.message);
      
      // All errors result in Unverified status
      await domain.update({ status: 'Unverified' });
      
      if (error.message.includes('Unable to determine server public IP')) {
        res.status(500).json({
          error: 'Unable to determine server IP address for verification',
          status: 'Unverified'
        });
      } else {
        res.status(400).json({
          error: 'Domain verification failed. Please check your DNS configuration.',
          status: 'Unverified',
          dnsError: error.message
        });
      }
    }

  } catch (error) {
    console.error('Error verifying domain:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Child Brands (Sublabel) Management

interface ChildBrandData {
  brand_id: number;
  brand_name: string;
  music_earnings: number;
  event_earnings: number;
  payments: number;
  commission: number;
  balance: number;
}

export const getChildBrands = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { start_date, end_date } = req.query as { start_date?: string; end_date?: string };

    // Commission rates - TODO: Make configurable
    const MUSIC_COMMISSION = 0.2; // 20%
    const EVENT_COMMISSION = 0.025; // 2.5%

    // Find all child brands
    const childBrands = await Brand.findAll({
      where: { parent_brand: brandId },
      attributes: ['id', 'brand_name']
    });

    if (childBrands.length === 0) {
      return res.json([]);
    }

    const childBrandData: ChildBrandData[] = [];

    for (const childBrand of childBrands) {
      let musicEarnings = 0;
      let eventEarnings = 0;
      const payments = 0; // TODO: Implement actual payments calculation

      // Get all release IDs for this brand
      const releaseIds = await Release.findAll({
        where: { brand_id: childBrand.id },
        attributes: ['id'],
        raw: true
      });
      
      const releaseIdList = releaseIds.map(r => (r as any).id);
      
      if (releaseIdList.length === 0) {
        musicEarnings = 0;
      } else {
        // Calculate music earnings (total earnings minus royalties for this brand's releases)
        const totalEarnings = await Earning.sum('amount', {
          where: {
            release_id: { [Op.in]: releaseIdList },
            ...(start_date && end_date ? {
              date_recorded: {
                [Op.between]: [new Date(start_date), new Date(end_date)]
              }
            } : {})
          }
        });

        const totalRoyalties = await Royalty.sum('amount', {
          where: {
            release_id: { [Op.in]: releaseIdList },
            ...(start_date && end_date ? {
              date_recorded: {
                [Op.between]: [new Date(start_date), new Date(end_date)]
              }
            } : {})
          }
        });

        musicEarnings = (totalEarnings || 0) - (totalRoyalties || 0);
      }

      // Calculate event earnings (ticket sales minus processing fees for this brand's events)
      const eventQuery = await Ticket.findAll({
        attributes: [
          [literal('SUM(price_per_ticket * number_of_entries)'), 'total_sales'],
          [literal('SUM(payment_processing_fee)'), 'total_processing_fee']
        ],
        include: [{
          model: Event,
          as: 'event',
          where: { brand_id: childBrand.id },
          attributes: []
        }],
        where: {
          status: ['Payment confirmed', 'Ticket sent.'],
          ...(start_date && end_date ? {
            order_timestamp: {
              [Op.between]: [new Date(start_date), new Date(end_date)]
            }
          } : {})
        },
        raw: true
      });

      if (eventQuery.length > 0 && eventQuery[0]) {
        const salesData = eventQuery[0] as any;
        eventEarnings = (parseFloat(salesData.total_sales) || 0) - (parseFloat(salesData.total_processing_fee) || 0);
      }

      // Calculate commission
      const commission = (musicEarnings * MUSIC_COMMISSION) + (eventEarnings * EVENT_COMMISSION);
      
      // Calculate balance
      const balance = musicEarnings + eventEarnings - commission - payments;

      childBrandData.push({
        brand_id: childBrand.id,
        brand_name: childBrand.brand_name,
        music_earnings: musicEarnings,
        event_earnings: eventEarnings,
        payments: payments,
        commission: commission,
        balance: balance
      });
    }

    res.json(childBrandData);

  } catch (error) {
    console.error('Error fetching child brands:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create Sublabel
export const createSublabel = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { brand_name, domain_name } = req.body;
    const currentUserId = (req as any).user?.id;

    // Validate input
    if (!brand_name || !domain_name) {
      return res.status(400).json({ error: 'Brand name and domain name are required' });
    }

    // Validate domain name format
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain_name)) {
      return res.status(400).json({ error: 'Invalid domain name format' });
    }

    // Check if parent brand exists
    const parentBrand = await Brand.findByPk(brandId);
    if (!parentBrand) {
      return res.status(404).json({ error: 'Parent brand not found' });
    }

    // Check if current user exists and get their information
    const currentUser = await User.findByPk(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found' });
    }

    // Check if domain already exists
    const existingDomain = await Domain.findOne({
      where: { domain_name: domain_name.toLowerCase().trim() }
    });
    if (existingDomain) {
      return res.status(409).json({ error: 'Domain already exists' });
    }

    // Create new brand (sublabel)
    const newBrand = await Brand.create({
      brand_name: brand_name.trim(),
      parent_brand: parseInt(brandId),
      logo_url: null,
      brand_color: '#6c757d', // Default gray color
      brand_website: '',
      favicon_url: null,
      paymongo_wallet_id: '',
      payment_processing_fee_for_payouts: 10.00, // Default 10%
      release_submission_url: '',
      catalog_prefix: ''
    });

    // Create domain for the new brand
    const newDomain = await Domain.create({
      brand_id: newBrand.id,
      domain_name: domain_name.toLowerCase().trim(),
      status: 'Unverified'
    });

    // Create admin user for the new brand (copy current user's info)
    const newUser = await User.create({
      username: currentUser.username,
      password_md5: currentUser.password_md5,
      email_address: currentUser.email_address,
      first_name: currentUser.first_name,
      last_name: currentUser.last_name,
      profile_photo: currentUser.profile_photo,
      is_admin: true, // New sublabel user is admin for their brand
      brand_id: newBrand.id,
      reset_hash: null, // Clear reset hash for new user
      last_logged_in: null // Clear last login for new user
    });

    res.status(201).json({
      message: 'Sublabel created successfully',
      sublabel: {
        id: newBrand.id,
        brand_name: newBrand.brand_name,
        domain_name: newDomain.domain_name,
        admin_user_id: newUser.id
      }
    });

  } catch (error) {
    console.error('Error creating sublabel:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};