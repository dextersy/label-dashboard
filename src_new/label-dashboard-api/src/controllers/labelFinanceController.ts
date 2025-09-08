import { Request, Response } from 'express';
import { Op, literal } from 'sequelize';
import { Earning, Royalty, Ticket, Event, Release, LabelPayment, Artist, Payment, LabelPaymentMethod } from '../models';

interface AuthRequest extends Request {
  user?: any;
}

export const getLabelFinanceDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const { brandId } = req.params;
    
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Verify that the authenticated user is an admin for the specific brand being queried
    if (req.user.brand_id !== parseInt(brandId)) {
      return res.status(403).json({ error: 'Access denied: You can only access data for your own brand' });
    }

    const { start_date, end_date } = req.query as { start_date?: string; end_date?: string };

    // Date filtering setup
    let startDateFilter, endDateFilter;
    if (start_date && end_date) {
      startDateFilter = new Date(start_date);
      endDateFilter = new Date(end_date);
      if (start_date === end_date) {
        endDateFilter.setHours(23, 59, 59, 999);
      }
    }

    // Calculate music earnings for this brand
    let musicEarnings = 0;
    let musicGrossEarnings = 0;
    let totalRoyalties = 0;
    let musicPlatformFees = 0;

    // Get all release IDs for this brand
    const releaseIds = await Release.findAll({
      where: { brand_id: req.user.brand_id },
      attributes: ['id'],
      raw: true
    });

    const releaseIdList = releaseIds.map(r => (r as any).id);

    if (releaseIdList.length > 0) {
      // Calculate total music earnings
      const totalEarnings = await Earning.sum('amount', {
        where: {
          release_id: { [Op.in]: releaseIdList },
          ...(startDateFilter && endDateFilter ? {
            date_recorded: {
              [Op.between]: [startDateFilter, endDateFilter]
            }
          } : {})
        }
      });

      // Calculate total royalties
      totalRoyalties = await Royalty.sum('amount', {
        where: {
          release_id: { [Op.in]: releaseIdList },
          ...(startDateFilter && endDateFilter ? {
            date_recorded: {
              [Op.between]: [startDateFilter, endDateFilter]
            }
          } : {})
        }
      }) || 0;

      // Calculate platform fees
      musicPlatformFees = await Earning.sum('platform_fee', {
        where: {
          release_id: { [Op.in]: releaseIdList },
          ...(startDateFilter && endDateFilter ? {
            date_recorded: {
              [Op.between]: [startDateFilter, endDateFilter]
            }
          } : {})
        }
      }) || 0;

      musicGrossEarnings = totalEarnings || 0;
      musicEarnings = musicGrossEarnings - totalRoyalties - musicPlatformFees;
    }

    // Calculate event earnings for this brand
    let eventEarnings = 0;
    let eventSales = 0;
    let eventPlatformFees = 0;
    let eventProcessingFees = 0;

    const eventQuery = await Ticket.findAll({
      attributes: [
        [literal('SUM(price_per_ticket * number_of_entries)'), 'total_sales'],
        [literal('SUM(platform_fee)'), 'total_platform_fee'],
        [literal('SUM(payment_processing_fee)'), 'total_processing_fee']
      ],
      include: [{
        model: Event,
        as: 'event',
        where: { brand_id: req.user.brand_id },
        attributes: []
      }],
      where: {
        status: { [Op.in]: ['Payment Confirmed', 'Ticket sent.'] },
        platform_fee: { [Op.not]: null },
        ...(startDateFilter && endDateFilter ? {
          date_paid: {
            [Op.between]: [startDateFilter, endDateFilter]
          }
        } : {})
      },
      raw: true
    });

    if (eventQuery.length > 0 && eventQuery[0]) {
      const salesData = eventQuery[0] as any;
      eventSales = parseFloat(salesData.total_sales) || 0;
      eventPlatformFees = parseFloat(salesData.total_platform_fee) || 0;
      eventProcessingFees = parseFloat(salesData.total_processing_fee) || 0;
      eventEarnings = eventSales - eventPlatformFees;
    }

    // Calculate total payments made to artists under this label
    const artistIds = await Artist.findAll({
      where: { brand_id: req.user.brand_id },
      attributes: ['id'],
      raw: true
    });

    const artistIdList = artistIds.map(a => (a as any).id);
    let artistPayments = 0;

    if (artistIdList.length > 0) {
      artistPayments = await Payment.sum('amount', {
        where: {
          artist_id: { [Op.in]: artistIdList },
          ...(startDateFilter && endDateFilter ? {
            date_paid: {
              [Op.between]: [startDateFilter, endDateFilter]
            }
          } : {})
        }
      }) || 0;
    }

    // Calculate total label payments (incoming payments to the label)
    const totalPayments = await LabelPayment.sum('amount', {
      where: {
        brand_id: req.user.brand_id,
        ...(startDateFilter && endDateFilter ? {
          date_paid: {
            [Op.between]: [startDateFilter, endDateFilter]
          }
        } : {})
      }
    }) || 0;

    // Calculate receivable balance (net earnings minus payments received by the label)
    const receivableBalance = musicEarnings + eventEarnings - totalPayments;

    res.json({
      net_music_earnings: musicEarnings,
      net_event_earnings: eventEarnings,
      total_payments: totalPayments,
      receivable_balance: receivableBalance,
      breakdown: {
        music: {
          gross_earnings: musicGrossEarnings,
          royalties: totalRoyalties,
          platform_fees: musicPlatformFees,
          net_earnings: musicEarnings
        },
        event: {
          sales: eventSales,
          platform_fees: eventPlatformFees,
          processing_fees: eventProcessingFees,
          net_earnings: eventEarnings
        },
        artist_payments: artistPayments
      }
    });

  } catch (error) {
    console.error('Error fetching label finance dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLabelFinanceBreakdown = async (req: AuthRequest, res: Response) => {
  try {
    const { brandId } = req.params;
    
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Verify that the authenticated user is an admin for the specific brand being queried
    if (req.user.brand_id !== parseInt(brandId)) {
      return res.status(403).json({ error: 'Access denied: You can only access data for your own brand' });
    }

    const { start_date, end_date, type } = req.query as { 
      start_date?: string; 
      end_date?: string; 
      type?: 'music' | 'event';
    };

    if (!type || !['music', 'event'].includes(type)) {
      return res.status(400).json({ error: 'Type parameter is required (music or event)' });
    }

    // Date filtering setup
    let startDateFilter, endDateFilter;
    if (start_date && end_date) {
      startDateFilter = new Date(start_date);
      endDateFilter = new Date(end_date);
      if (start_date === end_date) {
        endDateFilter.setHours(23, 59, 59, 999);
      }
    }

    if (type === 'music') {
      // Get music earnings breakdown by release
      const releaseIds = await Release.findAll({
        where: { brand_id: req.user.brand_id },
        attributes: ['id', 'title'],
        raw: true
      });

      const breakdown = [];

      for (const release of releaseIds) {
        const earnings = await Earning.sum('amount', {
          where: {
            release_id: release.id,
            ...(startDateFilter && endDateFilter ? {
              date_recorded: {
                [Op.between]: [startDateFilter, endDateFilter]
              }
            } : {})
          }
        }) || 0;

        const royalties = await Royalty.sum('amount', {
          where: {
            release_id: release.id,
            ...(startDateFilter && endDateFilter ? {
              date_recorded: {
                [Op.between]: [startDateFilter, endDateFilter]
              }
            } : {})
          }
        }) || 0;

        const platformFees = await Earning.sum('platform_fee', {
          where: {
            release_id: release.id,
            ...(startDateFilter && endDateFilter ? {
              date_recorded: {
                [Op.between]: [startDateFilter, endDateFilter]
              }
            } : {})
          }
        }) || 0;

        const netEarnings = earnings - royalties - platformFees;

        if (earnings > 0 || royalties > 0 || platformFees > 0) {
          breakdown.push({
            release_title: (release as any).title,
            gross_earnings: earnings,
            royalties: royalties,
            platform_fees: platformFees,
            net_earnings: netEarnings
          });
        }
      }

      res.json({ type: 'music', breakdown });

    } else if (type === 'event') {
      // Get event earnings breakdown by event
      const events = await Event.findAll({
        where: { brand_id: req.user.brand_id },
        attributes: ['id', 'title']
      });

      const breakdown = [];

      for (const event of events) {
        const eventQuery = await Ticket.findAll({
          attributes: [
            [literal('SUM(price_per_ticket * number_of_entries)'), 'total_sales'],
            [literal('SUM(platform_fee)'), 'total_platform_fee'],
            [literal('SUM(payment_processing_fee)'), 'total_processing_fee']
          ],
          where: {
            event_id: event.id,
            status: { [Op.in]: ['Payment Confirmed', 'Ticket sent.'] },
            platform_fee: { [Op.not]: null },
            ...(startDateFilter && endDateFilter ? {
              date_paid: {
                [Op.between]: [startDateFilter, endDateFilter]
              }
            } : {})
          },
          raw: true
        });

        if (eventQuery.length > 0 && eventQuery[0]) {
          const salesData = eventQuery[0] as any;
          const sales = parseFloat(salesData.total_sales) || 0;
          const platformFees = parseFloat(salesData.total_platform_fee) || 0;
          const processingFees = parseFloat(salesData.total_processing_fee) || 0;
          const netEarnings = sales - platformFees;

          if (sales > 0 || platformFees > 0 || processingFees > 0) {
            breakdown.push({
              event_name: event.title,
              sales: sales,
              platform_fees: platformFees,
              processing_fees: processingFees,
              net_earnings: netEarnings
            });
          }
        }
      }

      res.json({ type: 'event', breakdown });
    }

  } catch (error) {
    console.error('Error fetching label finance breakdown:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

