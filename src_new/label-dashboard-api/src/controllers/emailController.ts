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

    // Parse filter and sort parameters
    const sortBy = req.query.sortBy as string;
    const sortDirection = (req.query.sortDirection as string) || 'DESC';

    // Build where condition
    const whereCondition: any = { brand_id: req.user.brand_id };

    // Add filters
    const filterableFields = ['recipients', 'subject', 'timestamp', 'result'];
    filterableFields.forEach(field => {
      const filterValue = req.query[field] as string;
      if (filterValue && filterValue.trim() !== '') {
        if (field === 'timestamp') {
          // Handle date filter - search for dates containing the filter value
          whereCondition[field] = {
            [require('sequelize').Op.like]: `%${filterValue}%`
          };
        } else {
          // Handle text filters with partial matching
          whereCondition[field] = {
            [require('sequelize').Op.like]: `%${filterValue}%`
          };
        }
      }
    });

    // Build order clause
    let orderClause: any[] = [['timestamp', 'DESC']]; // Default ordering
    if (sortBy && filterableFields.includes(sortBy)) {
      const direction = sortDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      orderClause = [[sortBy, direction]];
    }

    const { count, rows: emailLogs } = await EmailAttempt.findAndCountAll({
      where: whereCondition,
      attributes: [
        'id',
        'recipients',
        'subject',
        'timestamp',
        'result'
      ],
      order: orderClause,
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

