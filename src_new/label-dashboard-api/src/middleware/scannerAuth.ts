import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Event, Brand, Domain } from '../models';
import { getRequestDomain } from '../utils/requestUtils';

export interface ScannerRequest extends Request {
  scannerEvent?: any;
  scannerEventId?: number;
  scannerBrandId?: number;
}

export const authenticateScannerToken = async (req: ScannerRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Scanner access token required' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    if (!decoded.eventId || !decoded.brandId || decoded.type !== 'scanner') {
      return res.status(401).json({ error: 'Invalid scanner token' });
    }

    const requestDomain = getRequestDomain(req);

    const event = await Event.findOne({
      where: { id: decoded.eventId },
      include: [{
        model: Brand,
        as: 'brand',
        include: [{
          model: Domain,
          as: 'domains',
          attributes: ['domain_name']
        }]
      }]
    });

    if (!event) {
      return res.status(401).json({ error: 'Event not found' });
    }

    // Validate domain
    if (event.brand && event.brand.domains && requestDomain) {
      const eventBrandDomains = event.brand.domains.map((d: any) => d.domain_name);
      if (!eventBrandDomains.includes(requestDomain)) {
        return res.status(403).json({ error: 'Domain mismatch' });
      }
    } else {
      return res.status(403).json({ error: 'Domain validation failed' });
    }

    req.scannerEvent = event;
    req.scannerEventId = decoded.eventId;
    req.scannerBrandId = decoded.brandId;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Scanner session expired' });
    }
    return res.status(401).json({ error: 'Invalid scanner token' });
  }
};
