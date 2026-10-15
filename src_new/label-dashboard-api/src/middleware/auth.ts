import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, AudienceUser, EventAccess } from '../models';

interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    // Reject non-user tokens (e.g. scanner tokens) from accessing authenticated routes
    if (decoded.type && decoded.type !== 'user') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const authenticateAudienceToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    if (decoded.type !== 'audience') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const audienceUser = await AudienceUser.findByPk(decoded.audienceUserId);
    if (!audienceUser) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    (req as any).audienceUser = audienceUser;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

export const requireEventAccess = (minRole: 'viewer' | 'manager') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    // Admins always have full access
    if (req.user.is_admin) return next();

    const eventId = parseInt(req.params.id as string, 10);
    if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });

    const access = await EventAccess.findOne({
      where: { event_id: eventId, user_id: req.user.id, status: 'Accepted' },
    });

    if (!access) return res.status(403).json({ error: 'No access to this event' });
    if (minRole === 'manager' && access.role !== 'manager') {
      return res.status(403).json({ error: 'Manager access required for this operation' });
    }

    next();
  };
};

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Check if user is superadmin based on admin email env variable
  const adminEmail = process.env.ADMIN_EMAIL;
  const isSuperadmin = adminEmail && req.user && req.user.email_address === adminEmail;
  
  if (!isSuperadmin) {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  next();
};