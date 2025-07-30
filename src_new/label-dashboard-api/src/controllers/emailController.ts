import { Request, Response } from 'express';
import { EmailAttempt } from '../models';

interface AuthRequest extends Request {
  user?: any;
}

export const getEmailLogs = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const { count, rows: emailLogs } = await EmailAttempt.findAndCountAll({
      where: { brand_id: req.user.brand_id },
      attributes: [
        'id',
        'recipients',
        'subject',
        'timestamp',
        'result'
      ],
      order: [['timestamp', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      data: emailLogs,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_count: count,
        per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    });
  } catch (error) {
    console.error('Get email logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEmailContent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const emailId = parseInt(req.params.id);
    
    if (!emailId) {
      return res.status(400).json({ error: 'Email ID is required' });
    }

    const emailAttempt = await EmailAttempt.findOne({
      where: { 
        id: emailId,
        brand_id: req.user.brand_id 
      },
      attributes: ['id', 'recipients', 'subject', 'body', 'timestamp', 'result']
    });

    if (!emailAttempt) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(emailAttempt);
  } catch (error) {
    console.error('Get email content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

