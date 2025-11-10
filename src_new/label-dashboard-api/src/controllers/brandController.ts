import { Request, Response } from 'express';
import Brand from '../models/Brand';
import Domain from '../models/Domain';
import User from '../models/User';
import { Earning, Royalty, Ticket, Event, Release, LabelPayment, Artist, Payment } from '../models';
import { Op, literal } from 'sequelize';
import multer from 'multer';
import path from 'path';
import AWS from 'aws-sdk';
import pngToIco from 'png-to-ico';
import dns from 'dns';
import { promisify } from 'util';
import { createSubdomainARecord } from '../utils/lightsailDNSService';
import { addDomainToSSL, removeDomainFromSSL, shouldAutoAddToSSL, logSSLOperation, isMeltRecordsSubdomain } from '../utils/sslManagementService';

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
      payment_processing_fee_for_payouts: brand.payment_processing_fee_for_payouts || 0,
      monthly_fee: brand.monthly_fee || 0,
      music_transaction_fixed_fee: brand.music_transaction_fixed_fee || 0,
      music_revenue_percentage_fee: brand.music_revenue_percentage_fee || 0,
      music_fee_revenue_type: brand.music_fee_revenue_type || 'net',
      event_transaction_fixed_fee: brand.event_transaction_fixed_fee || 0,
      event_revenue_percentage_fee: brand.event_revenue_percentage_fee || 0,
      event_fee_revenue_type: brand.event_fee_revenue_type || 'net'
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
      payment_processing_fee_for_payouts,
      monthly_fee,
      music_transaction_fixed_fee,
      music_revenue_percentage_fee,
      music_fee_revenue_type,
      event_transaction_fixed_fee,
      event_revenue_percentage_fee,
      event_fee_revenue_type
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
      payment_processing_fee_for_payouts: payment_processing_fee_for_payouts || 0,
      monthly_fee: monthly_fee !== undefined ? monthly_fee : brand.monthly_fee,
      music_transaction_fixed_fee: music_transaction_fixed_fee !== undefined ? music_transaction_fixed_fee : brand.music_transaction_fixed_fee,
      music_revenue_percentage_fee: music_revenue_percentage_fee !== undefined ? music_revenue_percentage_fee : brand.music_revenue_percentage_fee,
      music_fee_revenue_type: music_fee_revenue_type || brand.music_fee_revenue_type,
      event_transaction_fixed_fee: event_transaction_fixed_fee !== undefined ? event_transaction_fixed_fee : brand.event_transaction_fixed_fee,
      event_revenue_percentage_fee: event_revenue_percentage_fee !== undefined ? event_revenue_percentage_fee : brand.event_revenue_percentage_fee,
      event_fee_revenue_type: event_fee_revenue_type || brand.event_fee_revenue_type
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
        payment_processing_fee_for_payouts: brand.payment_processing_fee_for_payouts,
        monthly_fee: brand.monthly_fee,
        music_transaction_fixed_fee: brand.music_transaction_fixed_fee,
        music_revenue_percentage_fee: brand.music_revenue_percentage_fee,
        music_fee_revenue_type: brand.music_fee_revenue_type,
        event_transaction_fixed_fee: brand.event_transaction_fixed_fee,
        event_revenue_percentage_fee: brand.event_revenue_percentage_fee,
        event_fee_revenue_type: brand.event_fee_revenue_type
      }
    });

  } catch (error) {
    console.error('Error updating brand settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFeeSettings = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;

    const brand = await Brand.findByPk(brandId);

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    res.json({
      id: brand.id,
      monthly_fee: brand.monthly_fee || 0,
      music: {
        transaction_fixed_fee: brand.music_transaction_fixed_fee || 0,
        revenue_percentage_fee: brand.music_revenue_percentage_fee || 0,
        fee_revenue_type: brand.music_fee_revenue_type || 'net'
      },
      event: {
        transaction_fixed_fee: brand.event_transaction_fixed_fee || 0,
        revenue_percentage_fee: brand.event_revenue_percentage_fee || 0,
        fee_revenue_type: brand.event_fee_revenue_type || 'net'
      }
    });

  } catch (error) {
    console.error('Error fetching fee settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateFeeSettings = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { monthly_fee, music, event } = req.body;

    const brand = await Brand.findByPk(brandId);

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Validate monthly fee
    if (monthly_fee !== undefined && (isNaN(monthly_fee) || monthly_fee < 0)) {
      return res.status(400).json({ error: 'Monthly fee must be a non-negative number' });
    }

    // Validate music fee values
    if (music) {
      if (music.transaction_fixed_fee !== undefined && (isNaN(music.transaction_fixed_fee) || music.transaction_fixed_fee < 0)) {
        return res.status(400).json({ error: 'Music transaction fixed fee must be a non-negative number' });
      }
      if (music.revenue_percentage_fee !== undefined && (isNaN(music.revenue_percentage_fee) || music.revenue_percentage_fee < 0 || music.revenue_percentage_fee > 100)) {
        return res.status(400).json({ error: 'Music revenue percentage fee must be between 0 and 100' });
      }
      if (music.fee_revenue_type && !['net', 'gross'].includes(music.fee_revenue_type)) {
        return res.status(400).json({ error: 'Music fee revenue type must be either "net" or "gross"' });
      }
    }

    // Validate event fee values
    if (event) {
      if (event.transaction_fixed_fee !== undefined && (isNaN(event.transaction_fixed_fee) || event.transaction_fixed_fee < 0)) {
        return res.status(400).json({ error: 'Event transaction fixed fee must be a non-negative number' });
      }
      if (event.revenue_percentage_fee !== undefined && (isNaN(event.revenue_percentage_fee) || event.revenue_percentage_fee < 0 || event.revenue_percentage_fee > 100)) {
        return res.status(400).json({ error: 'Event revenue percentage fee must be between 0 and 100' });
      }
      if (event.fee_revenue_type && !['net', 'gross'].includes(event.fee_revenue_type)) {
        return res.status(400).json({ error: 'Event fee revenue type must be either "net" or "gross"' });
      }
    }

    // Update fee settings
    const updateData: any = {};
    
    if (monthly_fee !== undefined) updateData.monthly_fee = monthly_fee;
    
    if (music) {
      if (music.transaction_fixed_fee !== undefined) updateData.music_transaction_fixed_fee = music.transaction_fixed_fee;
      if (music.revenue_percentage_fee !== undefined) updateData.music_revenue_percentage_fee = music.revenue_percentage_fee;
      if (music.fee_revenue_type !== undefined) updateData.music_fee_revenue_type = music.fee_revenue_type;
    }
    
    if (event) {
      if (event.transaction_fixed_fee !== undefined) updateData.event_transaction_fixed_fee = event.transaction_fixed_fee;
      if (event.revenue_percentage_fee !== undefined) updateData.event_revenue_percentage_fee = event.revenue_percentage_fee;
      if (event.fee_revenue_type !== undefined) updateData.event_fee_revenue_type = event.fee_revenue_type;
    }

    await brand.update(updateData);

    res.json({
      message: 'Fee settings updated successfully',
      feeSettings: {
        id: brand.id,
        monthly_fee: brand.monthly_fee,
        music: {
          transaction_fixed_fee: brand.music_transaction_fixed_fee,
          revenue_percentage_fee: brand.music_revenue_percentage_fee,
          fee_revenue_type: brand.music_fee_revenue_type
        },
        event: {
          transaction_fixed_fee: brand.event_transaction_fixed_fee,
          revenue_percentage_fee: brand.event_revenue_percentage_fee,
          fee_revenue_type: brand.event_fee_revenue_type
        }
      }
    });

  } catch (error) {
    console.error('Error updating fee settings:', error);
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
    const finalDomainName = domain_name.toLowerCase().trim();
    const newDomain = await Domain.create({
      brand_id: parseInt(brandId),
      domain_name: finalDomainName,
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

    // Store status before deletion for SSL removal decision
    const wasConnectedOrNoSSL = domain.status === 'Connected' || domain.status === 'No SSL';

    // IMPORTANT: Remove domain from SSL certificate BEFORE deleting from database
    // This prevents SSL renewal failures from domains that no longer exist
    if (wasConnectedOrNoSSL) {
      console.log(`[SSL] Removing domain ${domainName} from SSL certificate before database deletion`);
      try {
        const sslResult = await removeDomainFromSSL(domainName);
        logSSLOperation(domainName, sslResult);

        if (!sslResult.success) {
          console.error(`[SSL] Warning: Failed to remove domain from SSL certificate, but continuing with database deletion`);
          console.error(`[SSL] Manual cleanup may be required: ${sslResult.error}`);
          // Continue with deletion anyway to avoid database/SSL inconsistency
        }
      } catch (sslError) {
        console.error(`[SSL] Error during SSL removal:`, sslError);
        // Continue with deletion anyway to avoid database/SSL inconsistency
      }
    } else {
      console.log(`[SSL] Skipping SSL removal for domain ${domainName} - status is ${domain.status}`);
    }

    // Delete the domain from database
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

// Domain verification response interface
export interface DomainVerificationResponse {
  message: string;
  status?: string;
  domain_name?: string;
  estimated_completion?: string;
  domain?: {
    domain_name: string;
    status: 'Unverified' | 'Pending' | 'No SSL' | 'Connected';
    brand_id: number;
    verification_message: string;
    ssl_configured: boolean;
    ssl_message: string;
  };
}


// Async function to handle the heavy lifting of domain verification
const verifyDomainAsync = async (
  brandId: string,
  domainName: string,
  brandName: string
) => {
  try {
    console.log(`[Async] Starting domain verification for: ${domainName}`);
    
    // Find the domain
    const domain = await Domain.findOne({
      where: {
        brand_id: brandId,
        domain_name: domainName
      }
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    // Get frontend server IP from environment variable
    const frontendIP = process.env.FRONTEND_IP;
    if (!frontendIP) {
      throw new Error('FRONTEND_IP environment variable is not configured');
    }
    
    console.log(`[Async] Verifying domain ${domainName} against frontend IP ${frontendIP}`);
    
    // Resolve domain's A record
    const addresses = await dnsResolve4(domainName);
    console.log(`[Async] Domain ${domainName} resolves to:`, addresses);
    
    // Check if any of the resolved addresses match our frontend IP
    const isVerified = addresses.some(addr => addr === frontendIP);
    console.log(`[Async] Domain verification result: ${isVerified ? 'VERIFIED' : 'FAILED'}`);
    
    let finalStatus: 'Unverified' | 'No SSL' | 'Connected' = 'Unverified';
    let resultMessage = '';
    let sslConfigured = false;
    let sslMessage = '';
    
    // If domain is pointing to correct IP, try to add to SSL certificate
    if (isVerified) {
      // All verified domains should have SSL certificates added
      if (shouldAutoAddToSSL(domainName)) {
        try {
          console.log(`[Async][SSL] Attempting to add ${domainName} to SSL certificate`);
          const sslResult = await addDomainToSSL(domainName);
          logSSLOperation(domainName, sslResult);
          
          finalStatus = sslResult.success ? 'Connected' : 'No SSL';
          sslConfigured = sslResult.success;
          sslMessage = sslResult.message;
          
          if (sslResult.success) {
            resultMessage = 'Domain verified and SSL certificate updated successfully';
          } else {
            resultMessage = `Domain points to correct IP but SSL certificate update failed: ${sslResult.error || 'SSL certificate update failed'}`;
          }
        } catch (sslError) {
          console.error(`[Async][SSL] Error during SSL certificate update for ${domainName}:`, sslError);
          finalStatus = 'No SSL';
          resultMessage = 'Domain points to correct IP but SSL certificate update failed due to connection error';
          sslMessage = 'SSL service connection error';
        }
      } else {
        // Domain verified but SSL validation failed (invalid domain format)
        finalStatus = 'No SSL';
        resultMessage = 'Domain verified but SSL certificate could not be created (invalid domain format)';
      }
    } else {
      // Domain not pointing to correct IP
      finalStatus = 'Unverified';
      resultMessage = `Domain verification failed. Domain does not point to our frontend server. Expected IP: ${frontendIP}, Resolved IPs: ${addresses.join(', ')}`;
    }
    
    // Update domain status
    await domain.update({ status: finalStatus });
    
    console.log(`[Async] Domain verification completed for ${domainName} with status: ${finalStatus}`);
    
    return {
      success: true,
      domain: {
        domain_name: domainName,
        status: finalStatus,
        brand_id: parseInt(brandId),
        verification_message: resultMessage,
        ssl_configured: sslConfigured,
        ssl_message: sslMessage
      }
    };

  } catch (error) {
    console.error(`[Async] Error verifying domain "${domainName}":`, error);
    
    // Set domain to Unverified on any error
    try {
      const domain = await Domain.findOne({
        where: {
          brand_id: brandId,
          domain_name: domainName
        }
      });
      if (domain) {
        await domain.update({ status: 'Unverified' });
      }
    } catch (updateError) {
      console.error(`[Async] Failed to update domain status to Unverified:`, updateError);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
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

    // Set domain status to Pending while verification is in progress
    await domain.update({ status: 'Pending' });

    // Start async domain verification process
    setImmediate(() => {
      verifyDomainAsync(brandId, domainName, brand.brand_name);
    });

    // Return immediately with job started response
    res.status(202).json({
      message: 'Domain verification started',
      status: 'processing',
      domain_name: domainName,
      estimated_completion: 'A few minutes'
    });

  } catch (error) {
    console.error('Error starting domain verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Child Brands (Sublabel) Management

// Helper function to calculate sublabel status based on domains
const calculateSublabelStatus = (domains: Array<{ status: string }>): string => {
  if (domains.length === 0) {
    return 'No domains';
  }
  
  const statuses = domains.map(d => d.status);
  const connectedCount = statuses.filter(s => s === 'Connected').length;
  const unverifiedCount = statuses.filter(s => s === 'Unverified').length;
  const noSslCount = statuses.filter(s => s === 'No SSL').length;
  const pendingCount = statuses.filter(s => s === 'Pending').length;
  
  // At least one domain is pending
  if (pendingCount > 0) {
    return 'Pending';
  }
  
  // All domains are connected
  if (connectedCount === statuses.length) {
    return 'OK';
  }
  
  // All domains are unverified
  if (unverifiedCount === statuses.length) {
    return 'Unverified';
  }
  
  // Some domains are unverified or have no SSL
  if (unverifiedCount > 0 || noSslCount > 0) {
    return 'Warning';
  }
  
  // Default case - should not happen but return warning for safety
  return 'Warning';
};

interface ChildBrandData {
  brand_id: number;
  brand_name: string;
  music_earnings: number;
  music_gross_earnings: number;
  event_earnings: number;
  event_sales: number;
  event_processing_fees: number;
  event_estimated_tax: number;
  total_royalties: number;
  artist_payments: number;
  payments: number;
  platform_fees: number;
  music_platform_fees: number;
  event_platform_fees: number;
  balance: number;
  status: string;
  domains: Array<{
    domain_name: string;
    status: string;
    brand_id: number;
  }>;
}

export const getChildBrands = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { start_date, end_date } = req.query as { start_date?: string; end_date?: string };

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
      let musicGrossEarnings = 0;
      let eventEarnings = 0;
      let eventSales = 0;
      let eventProcessingFees = 0;
      let eventEstimatedTax = 0;
      let totalRoyalties = 0;
      let artistPayments = 0;
      
      // Calculate total payments made to this sublabel from label_payment table
      const payments = await LabelPayment.sum('amount', {
        where: {
          brand_id: childBrand.id,
          ...(start_date && end_date ? {
            date_paid: {
              [Op.between]: [new Date(start_date), new Date(end_date)]
            }
          } : {})
        }
      }) || 0;

      // Get all release IDs for this brand
      const releaseIds = await Release.findAll({
        where: { brand_id: childBrand.id },
        attributes: ['id'],
        raw: true
      });
      
      const releaseIdList = releaseIds.map(r => (r as any).id);
      
      let musicPlatformFees = 0;
      if (releaseIdList.length === 0) {
        musicEarnings = 0;
        musicGrossEarnings = 0;
        musicPlatformFees = 0;
        totalRoyalties = 0;
      } else {
        // Calculate music earnings (total earnings minus royalties minus platform fees for this brand's releases)
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

        totalRoyalties = await Royalty.sum('amount', {
          where: {
            release_id: { [Op.in]: releaseIdList },
            ...(start_date && end_date ? {
              date_recorded: {
                [Op.between]: [new Date(start_date), new Date(end_date)]
              }
            } : {})
          }
        }) || 0;

        const totalPlatformFees = await Earning.sum('platform_fee', {
          where: {
            release_id: { [Op.in]: releaseIdList },
            ...(start_date && end_date ? {
              date_recorded: {
                [Op.between]: [new Date(start_date), new Date(end_date)]
              }
            } : {})
          }
        });

        musicGrossEarnings = totalEarnings || 0;
        musicEarnings = musicGrossEarnings - totalRoyalties - (totalPlatformFees || 0);
        musicPlatformFees = totalPlatformFees || 0;
      }

      // Fix date range to include full day
      let startDateFilter, endDateFilter;
      if (start_date && end_date) {
        startDateFilter = new Date(start_date);
        endDateFilter = new Date(end_date);
        // Always extend end date to end of day
        endDateFilter.setHours(23, 59, 59, 999);
      }


      // Calculate event sales, earnings, and fees (ticket sales minus platform fees for this brand's events, excluding tickets where platform_fee is NULL)
      // For sales: only count confirmed/sent tickets (exclude refunded)
      const eventSalesQuery = await Ticket.findAll({
        attributes: [
          [literal('SUM(price_per_ticket * number_of_entries)'), 'total_sales']
        ],
        include: [{
          model: Event,
          as: 'event',
          where: { brand_id: childBrand.id },
          attributes: []
        }],
        where: {
          status: ['Payment Confirmed', 'Ticket sent.'],
          platform_fee: { [Op.not]: null },
          ...(startDateFilter && endDateFilter ? {
            date_paid: {
              [Op.between]: [startDateFilter, endDateFilter]
            }
          } : {})
        },
        raw: true
      });

      // For fees: count confirmed/sent AND refunded tickets
      const eventFeesQuery = await Ticket.findAll({
        attributes: [
          [literal('SUM(platform_fee)'), 'total_platform_fee'],
          [literal('SUM(payment_processing_fee)'), 'total_processing_fee']
        ],
        include: [{
          model: Event,
          as: 'event',
          where: { brand_id: childBrand.id },
          attributes: []
        }],
        where: {
          status: ['Payment Confirmed', 'Ticket sent.', 'Refunded'],
          platform_fee: { [Op.not]: null },
          ...(startDateFilter && endDateFilter ? {
            date_paid: {
              [Op.between]: [startDateFilter, endDateFilter]
            }
          } : {})
        },
        raw: true
      });

      let eventPlatformFees = 0;
      if (eventSalesQuery.length > 0 && eventSalesQuery[0]) {
        const salesData = eventSalesQuery[0] as any;
        eventSales = parseFloat(salesData.total_sales) || 0;
      }

      if (eventFeesQuery.length > 0 && eventFeesQuery[0]) {
        const feesData = eventFeesQuery[0] as any;
        eventPlatformFees = parseFloat(feesData.total_platform_fee) || 0;
        eventProcessingFees = parseFloat(feesData.total_processing_fee) || 0;
      }

      eventEarnings = eventSales - eventPlatformFees;

      // Calculate estimated tax: 0.5% of (gross event earnings - processing fees)
      const taxableAmount = eventSales - eventProcessingFees;
      eventEstimatedTax = taxableAmount * 0.005; // 0.5%

      // Calculate total artist payments for artists under this sublabel
      const artistIds = await Artist.findAll({
        where: { brand_id: childBrand.id },
        attributes: ['id'],
        raw: true
      });
      
      const artistIdList = artistIds.map(a => (a as any).id);
      
      if (artistIdList.length > 0) {
        artistPayments = await Payment.sum('amount', {
          where: {
            artist_id: { [Op.in]: artistIdList },
            ...(start_date && end_date ? {
              date_paid: {
                [Op.between]: [new Date(start_date), new Date(end_date)]
              }
            } : {})
          }
        }) || 0;
      }

      // Calculate balance
      const balance = musicEarnings + eventEarnings - payments;

      // Get domains for this child brand
      const domains = await Domain.findAll({
        where: { brand_id: childBrand.id },
        attributes: ['domain_name', 'status'],
        order: [['status', 'DESC']] // Verified domains first
      });

      const domainData = domains.map(d => ({
        domain_name: d.domain_name,
        status: d.status,
        brand_id: childBrand.id
      }));

      childBrandData.push({
        brand_id: childBrand.id,
        brand_name: childBrand.brand_name,
        music_earnings: musicEarnings,
        music_gross_earnings: musicGrossEarnings,
        event_earnings: eventEarnings,
        event_sales: eventSales,
        event_processing_fees: eventProcessingFees,
        event_estimated_tax: eventEstimatedTax,
        total_royalties: totalRoyalties,
        artist_payments: artistPayments,
        payments: payments,
        platform_fees: musicPlatformFees + eventPlatformFees,
        music_platform_fees: musicPlatformFees,
        event_platform_fees: eventPlatformFees,
        balance: balance,
        status: calculateSublabelStatus(domainData),
        domains: domainData
      });
    }

    res.json(childBrandData);

  } catch (error) {
    console.error('Error fetching child brands:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Async function to handle the heavy lifting of sublabel creation
const createSublabelAsync = async (
  brandId: string,
  brand_name: string,
  domain_name: string | undefined,
  subdomain_name: string | undefined,
  currentUserId: number,
  parentBrandName: string
) => {
  try {
    console.log(`[Async] Starting sublabel creation for: ${brand_name}`);
    
    let finalDomainName: string;
    let isSubdomainOfMeltRecords = false;

    // Handle new subdomain format
    if (subdomain_name) {
      const baseDomain = process.env.LIGHTSAIL_DOMAIN;
      if (!baseDomain) {
        throw new Error('LIGHTSAIL_DOMAIN environment variable is not configured');
      }
      finalDomainName = `${subdomain_name.toLowerCase()}.${baseDomain}`;
      isSubdomainOfMeltRecords = true;
    } else {
      finalDomainName = domain_name!.toLowerCase().trim();
    }

    // Get user information
    const currentUser = await User.findByPk(currentUserId);
    if (!currentUser) {
      throw new Error('Current user not found');
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

    console.log(`[Async] Created brand with ID: ${newBrand.id}`);

    // Create domain for the new brand
    let domainStatus: 'Unverified' | 'Pending' | 'No SSL' | 'Connected' = 'Unverified';
    
    // Initialize SSL status variables
    let sslConfigured = false;
    let sslMessage = 'SSL certificate not configured (DNS not created automatically)';
    
    // Create DNS A record for melt-records.com subdomains
    if (isSubdomainOfMeltRecords && subdomain_name) {
      try {
        console.log(`[Async] Creating DNS A record for ${subdomain_name}.melt-records.com`);
        const dnsCreated = await createSubdomainARecord(subdomain_name.toLowerCase());
        if (dnsCreated) {
          domainStatus = 'Pending'; // Set to Pending while SSL is being configured
          console.log(`[Async] DNS A record created successfully for ${subdomain_name}.melt-records.com`);
          
          // Automatically add domain to SSL certificate when DNS is successfully created
          // For melt-records.com subdomains, we know they will point to the correct IP after DNS creation
          if (isMeltRecordsSubdomain(finalDomainName) && shouldAutoAddToSSL(finalDomainName)) {
            try {
              console.log(`[Async][SSL] Attempting to add ${finalDomainName} to SSL certificate`);
              const sslResult = await addDomainToSSL(finalDomainName);
              logSSLOperation(finalDomainName, sslResult);
              
              sslConfigured = sslResult.success;
              sslMessage = sslResult.message;
              
              if (sslResult.success) {
                domainStatus = 'Connected';
              } else {
                domainStatus = 'No SSL';
                console.warn(`[Async][SSL] Failed to add ${finalDomainName} to SSL certificate: ${sslResult.error}`);
                sslMessage = `DNS configured successfully, but SSL certificate update failed: ${sslResult.error || 'Unknown error'}. Manual SSL configuration required.`;
              }
            } catch (sslError) {
              console.error(`[Async][SSL] Error during SSL certificate update for ${finalDomainName}:`, sslError);
              sslMessage = 'DNS configured successfully, but SSL certificate update failed due to connection error. Manual SSL configuration required.';
            }
          } else {
            console.log(`[Async][SSL] Skipping SSL certificate update for ${finalDomainName} during creation (not a melt-records.com subdomain or invalid format). Use verify domain to add SSL after IP verification.`);
            sslMessage = 'DNS configured successfully. Use "Verify Domain" after confirming IP points to server to add SSL certificate.';
          }
        } else {
          console.warn(`[Async] DNS A record creation failed for ${subdomain_name}.melt-records.com`);
        }
      } catch (dnsError) {
        console.error(`[Async] DNS creation error for ${subdomain_name}.melt-records.com:`, dnsError);
      }
    }

    const newDomain = await Domain.create({
      brand_id: newBrand.id,
      domain_name: finalDomainName,
      status: domainStatus
    });

    console.log(`[Async] Created domain: ${finalDomainName} with status: ${domainStatus}`);

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

    console.log(`[Async] Created admin user with ID: ${newUser.id}`);

    // Log successful completion
    console.log(`[Async] Sublabel "${brand_name}" created successfully for parent brand "${parentBrandName}"`);

    // TODO: For production, implement WebSocket or Server-Sent Events for real-time notifications
    // For now, we'll rely on the frontend to detect completion through other means
    // The completion notification will be handled when user checks brand settings or refreshes sublabels list

    return {
      success: true,
      sublabel: {
        id: newBrand.id,
        brand_name: newBrand.brand_name,
        domain_name: newDomain.domain_name,
        domain_status: newDomain.status,
        admin_user_id: newUser.id,
        dns_configured: isSubdomainOfMeltRecords && (domainStatus === 'Connected' || domainStatus === 'No SSL' || domainStatus === 'Pending'),
        ssl_configured: sslConfigured,
        ssl_message: sslMessage
      }
    };

  } catch (error) {
    console.error(`[Async] Error creating sublabel "${brand_name}":`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Create Sublabel (now async)
export const createSublabel = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { brand_name, domain_name, subdomain_name } = req.body;
    const currentUserId = (req as any).user?.id;

    // Validate input
    if (!brand_name) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    if (!subdomain_name && !domain_name) {
      return res.status(400).json({ error: 'Subdomain name is required' });
    }

    let finalDomainName: string;

    // Handle new subdomain format
    if (subdomain_name) {
      // Validate subdomain format
      const subdomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
      if (!subdomainRegex.test(subdomain_name)) {
        return res.status(400).json({ error: 'Invalid subdomain format. Use only letters, numbers, and hyphens.' });
      }
      
      const baseDomain = process.env.LIGHTSAIL_DOMAIN;
      if (!baseDomain) {
        return res.status(500).json({ error: 'LIGHTSAIL_DOMAIN environment variable is not configured' });
      }
      finalDomainName = `${subdomain_name.toLowerCase()}.${baseDomain}`;
    } else {
      // Handle legacy domain format
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!domainRegex.test(domain_name)) {
        return res.status(400).json({ error: 'Invalid domain name format' });
      }
      finalDomainName = domain_name.toLowerCase().trim();
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
      where: { domain_name: finalDomainName }
    });
    if (existingDomain) {
      return res.status(409).json({ error: 'Domain already exists' });
    }

    // Start async sublabel creation process
    setImmediate(() => {
      createSublabelAsync(brandId, brand_name, domain_name, subdomain_name, currentUserId, parentBrand.brand_name);
    });

    // Return immediately with job started response
    res.status(202).json({
      message: 'Sublabel creation started',
      status: 'processing',
      brand_name: brand_name.trim(),
      estimated_completion: 'A few minutes'
    });

  } catch (error) {
    console.error('Error starting sublabel creation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};