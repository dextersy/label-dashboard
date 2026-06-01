import { Request, Response } from 'express';
import { Release, Artist, Earning, Royalty, Payment, Event, Ticket, ReleaseArtist, ArtistAccess, Fundraiser, Donation, ArtistImage, PaymentMethod } from '../models';

interface AuthRequest extends Request {
  user?: any;
}

// Get latest releases for dashboard
export const getLatestReleases = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || undefined;
    
    let releaseQuery: any = {
      where: { brand_id: req.user.brand_id },
      include: [
        {
          model: ReleaseArtist,
          as: 'releaseArtists',
          include: [
            {
              model: Artist,
              as: 'artist'
            }
          ]
        }
      ],
      order: [['release_date', 'DESC']],
      limit: limit
    };

    // For non-admin users, only show releases where they have access to the artist
    if (!req.user.is_admin) {
      // Get accessible artist IDs first
      const artistAccess = await ArtistAccess.findAll({
        where: { 
          user_id: req.user.id,
          status: 'Accepted'
        },
        attributes: ['artist_id']
      });
      
      const accessibleArtistIds = artistAccess.map(access => access.artist_id);
      
      if (accessibleArtistIds.length === 0) {
        return res.json({ releases: [] }); // No accessible artists, return empty array
      }

      // Filter releases to only include those with accessible artists
      releaseQuery.include[0].where = {
        artist_id: accessibleArtistIds
      };
      releaseQuery.include[0].required = true;
    }

    const releases = await Release.findAll(releaseQuery);

    // Transform data to match PHP structure
    const transformedReleases = releases.map(release => ({
      id: release.id,
      catalog_no: release.catalog_no,
      title: release.title,
      release_date: release.release_date,
      cover_art: release.cover_art,
      artist_name: release.releaseArtists && release.releaseArtists.length > 0 
        ? release.releaseArtists[0].artist?.name 
        : 'Unknown Artist'
    }));

    res.json({ releases: transformedReleases });
  } catch (error) {
    console.error('Get latest releases error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get top earning releases for dashboard
export const getTopEarningReleases = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || undefined;
    
    // Get all releases with their earnings (no initial limit to ensure proper sorting)
    const releases = await Release.findAll({
      where: { brand_id: req.user.brand_id },
      include: [
        {
          model: ReleaseArtist,
          as: 'releaseArtists',
          include: [
            {
              model: Artist,
              as: 'artist'
            }
          ]
        },
        {
          model: Earning,
          as: 'earnings',
          required: false
        }
      ]
      // Remove order and limit here since we need to calculate totals first
    });

    // Calculate total earnings for each release and sort by total earnings
    const releasesWithEarnings = releases.map(release => {
      const totalEarnings = release.earnings?.reduce((sum, earning) => {
        return sum + (parseFloat(earning.amount?.toString() || '0'));
      }, 0) || 0;

      return {
        id: release.id,
        catalog_no: release.catalog_no,
        title: release.title,
        total_earnings: totalEarnings,
        cover_art: release.cover_art,
        artist_name: release.releaseArtists && release.releaseArtists.length > 0 
          ? release.releaseArtists[0].artist?.name 
          : 'Unknown Artist'
      };
    }).sort((a, b) => b.total_earnings - a.total_earnings) // Sort by total earnings descending
      .slice(0, limit); // Apply limit after sorting

    res.json({ releases: releasesWithEarnings });
  } catch (error) {
    console.error('Get top earning releases error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get balance summary for dashboard
export const getBalanceSummary = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || undefined;
    
    let artists;
    if (req.user.is_admin) {
      artists = await Artist.findAll({
        where: { brand_id: req.user.brand_id },
        limit: limit
      });
    } else {
      // For non-admin users, get accessible artist IDs first
      const artistAccess = await ArtistAccess.findAll({
        where: { 
          user_id: req.user.id,
          status: 'Accepted'
        },
        attributes: ['artist_id']
      });
      
      const accessibleArtistIds = artistAccess.map(access => access.artist_id);
      
      if (accessibleArtistIds.length === 0) {
        return res.json({ artists: [] }); // No accessible artists, return empty array
      }

      artists = await Artist.findAll({
        where: { 
          brand_id: req.user.brand_id,
          id: accessibleArtistIds
        },
        limit: limit
      });
    }

    // Calculate balance for each artist
    const artistBalances = await Promise.all(
      artists.map(async (artist) => {
        // Get total royalties for artist
        const totalRoyalties = await Royalty.sum('amount', {
          where: { artist_id: artist.id }
        }) || 0;

        // Get total payments for artist
        const totalPayments = await Payment.sum('amount', {
          where: { artist_id: artist.id, status: 'succeeded' }
        }) || 0;

        const balance = totalRoyalties - totalPayments;

        return {
          id: artist.id,
          name: artist.name,
          balance: balance,
          profile_photo: artist.profile_photo
        };
      })
    );

    res.json({ artists: artistBalances });
  } catch (error) {
    console.error('Get balance summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get event sales data for chart (admin only)
export const getEventSalesChart = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const limit = parseInt(req.query.limit as string) || 5;

    const events = await Event.findAll({
      where: { brand_id: req.user.brand_id },
      order: [['id', 'DESC']],
      limit: limit
    });

    // Calculate sales data for each event
    const eventSales = await Promise.all(
      events.map(async (event) => {
        // Get all tickets for event
        const tickets = await Ticket.findAll({
          where: { 
            event_id: event.id
          },
          attributes: ['price_per_ticket', 'number_of_entries', 'number_of_claimed_entries', 'status']
        });
        
        // Calculate total sales from confirmed tickets
        const confirmedTickets = tickets.filter(ticket => ticket.status === 'Payment Confirmed' || ticket.status === 'Ticket sent.');
        const totalSales = confirmedTickets.reduce((sum, ticket) => {
          const price = parseFloat(ticket.price_per_ticket?.toString() || '0');
          const entries = parseInt(ticket.number_of_entries?.toString() || '1');
          const ticketAmount = price * entries;
          return sum + (isNaN(ticketAmount) ? 0 : ticketAmount);
        }, 0);

        // Calculate ticket counts
        const ticketsSold = confirmedTickets.reduce((sum, ticket) => {
          const entries = parseInt(ticket.number_of_entries?.toString() || '1');
          return sum + (isNaN(entries) ? 0 : entries);
        }, 0);
        
        const totalTickets = tickets.reduce((sum, ticket) => {
          const entries = parseInt(ticket.number_of_entries?.toString() || '1');
          return sum + (isNaN(entries) ? 0 : entries);
        }, 0);
        
        // Calculate total checked in from confirmed tickets
        const totalCheckedIn = confirmedTickets.reduce((sum, ticket) => {
          const checkedIn = parseInt(ticket.number_of_claimed_entries?.toString() || '0');
          return sum + (isNaN(checkedIn) ? 0 : checkedIn);
        }, 0);

        return {
          id: event.id,
          name: event.title || 'Untitled Event',
          location: event.venue || 'TBA',
          date: event.date_and_time || event.createdAt,
          total_sales: isNaN(totalSales) ? 0 : totalSales,
          tickets_sold: isNaN(ticketsSold) ? 0 : ticketsSold,
          total_tickets: isNaN(totalTickets) ? 0 : totalTickets,
          total_checked_in: isNaN(totalCheckedIn) ? 0 : totalCheckedIn
        };
      })
    );

    res.json({ events: eventSales });
  } catch (error) {
    console.error('Get event sales chart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get complete dashboard data
export const getDashboardData = async (req: AuthRequest, res: Response) => {
  try {
    const artistId = req.query.artist_id ? parseInt(req.query.artist_id as string) : null;

    const [latestReleases, topEarningReleases, stats, latestRelease, latestEarning, checklist, balanceSummary, releasePipeline, recentArtists] = await Promise.all([
      getLatestReleasesData(req, artistId),
      getTopEarningReleasesData(req, artistId),
      getDashboardStatsData(req, artistId),
      getLatestReleaseWithEarnings(req, artistId),
      getLatestEarningData(req, artistId),
      getChecklistData(req, artistId),
      getBalanceSummaryData(req),
      getReleasePipelineData(req),
      getRecentArtistsData(req)
    ]);

    const dashboardData: any = {
      user: {
        firstName: req.user.first_name,
        isAdmin: req.user.is_admin
      },
      latestRelease,
      latestReleases,
      topEarningReleases,
      stats,
      latestEarning,
      checklist,
      balanceSummary,
      releasePipeline,
      recentArtists
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Get dashboard data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper functions to get data without response
async function getLatestReleasesData(req: AuthRequest, artistId: number | null = null) {
  let artistFilter: number[] | null = null;

  if (!req.user.is_admin) {
    const artistAccess = await ArtistAccess.findAll({
      where: { user_id: req.user.id, status: 'Accepted' },
      attributes: ['artist_id']
    });
    const accessibleIds = artistAccess.map(access => access.artist_id);
    if (accessibleIds.length === 0) return [];
    artistFilter = artistId ? accessibleIds.filter(id => id === artistId) : accessibleIds;
    if (artistFilter.length === 0) return [];
  } else if (artistId) {
    artistFilter = [artistId];
  }

  const releaseQuery: any = {
    where: { brand_id: req.user.brand_id },
    include: [{
      model: ReleaseArtist,
      as: 'releaseArtists',
      include: [{ model: Artist, as: 'artist' }],
      ...(artistFilter ? { where: { artist_id: artistFilter }, required: true } : {})
    }],
    order: [['release_date', 'DESC']],
    limit: 5
  };

  const releases = await Release.findAll(releaseQuery);

  return releases.map(release => {
    const primaryArtist = release.releaseArtists && release.releaseArtists.length > 0
      ? release.releaseArtists[0].artist
      : null;
    return {
      id: release.id,
      catalog_no: release.catalog_no,
      title: release.title,
      release_date: release.release_date,
      cover_art: release.cover_art,
      status: release.status,
      artist_id: primaryArtist?.id || null,
      artist_name: primaryArtist?.name || 'Unknown Artist'
    };
  });
}

async function getTopEarningReleasesData(req: AuthRequest, artistId: number | null = null) {
  let artistFilter: number[] | null = null;

  if (!req.user.is_admin) {
    const artistAccess = await ArtistAccess.findAll({
      where: { user_id: req.user.id, status: 'Accepted' },
      attributes: ['artist_id']
    });
    const accessibleIds = artistAccess.map(access => access.artist_id);
    if (accessibleIds.length === 0) return [];
    artistFilter = artistId ? accessibleIds.filter(id => id === artistId) : accessibleIds;
    if (artistFilter.length === 0) return [];
  } else if (artistId) {
    artistFilter = [artistId];
  }

  const releaseQuery: any = {
    where: { brand_id: req.user.brand_id },
    include: [
      {
        model: ReleaseArtist,
        as: 'releaseArtists',
        include: [{ model: Artist, as: 'artist' }],
        ...(artistFilter ? { where: { artist_id: artistFilter }, required: true } : {})
      },
      { model: Earning, as: 'earnings', required: false }
    ]
  };

  const releases = await Release.findAll(releaseQuery);

  return releases.map(release => {
    const totalEarnings = release.earnings?.reduce((sum, earning) => {
      return sum + (parseFloat(earning.amount?.toString() || '0'));
    }, 0) || 0;

    return {
      id: release.id,
      catalog_no: release.catalog_no,
      title: release.title,
      total_earnings: totalEarnings,
      cover_art: release.cover_art,
      artist_name: release.releaseArtists && release.releaseArtists.length > 0
        ? release.releaseArtists[0].artist?.name
        : 'Unknown Artist'
    };
  }).sort((a, b) => b.total_earnings - a.total_earnings)
    .slice(0, 6);
}

async function getBalanceSummaryData(req: AuthRequest) {
  let artists;
  if (req.user.is_admin) {
    artists = await Artist.findAll({
      where: { brand_id: req.user.brand_id },
      limit: 5
    });
  } else {
    // For non-admin users, get accessible artist IDs first
    const artistAccess = await ArtistAccess.findAll({
      where: { 
        user_id: req.user.id,
        status: 'Accepted'
      },
      attributes: ['artist_id']
    });
    
    const accessibleArtistIds = artistAccess.map(access => access.artist_id);
    
    if (accessibleArtistIds.length === 0) {
      return []; // No accessible artists, return empty array
    }

    artists = await Artist.findAll({
      where: { 
        brand_id: req.user.brand_id,
        id: accessibleArtistIds
      },
      limit: 5
    });
  }

  return await Promise.all(
    artists.map(async (artist) => {
      const totalRoyalties = await Royalty.sum('amount', {
        where: { artist_id: artist.id }
      }) || 0;

      const totalPayments = await Payment.sum('amount', {
        where: { artist_id: artist.id, status: 'succeeded' }
      }) || 0;

      const balance = totalRoyalties - totalPayments;

      return {
        id: artist.id,
        name: artist.name,
        balance: balance,
        profile_photo: artist.profile_photo
      };
    })
  );
}

async function getEventSalesData(req: AuthRequest) {
  const events = await Event.findAll({
    where: { brand_id: req.user.brand_id },
    order: [['id', 'DESC']],
    limit: 5
  });

  return await Promise.all(
    events.map(async (event) => {
      const tickets = await Ticket.findAll({
        where: { 
          event_id: event.id
        },
        attributes: ['price_per_ticket', 'number_of_entries', 'number_of_claimed_entries', 'status']
      });
      
      // Calculate total sales from confirmed tickets
      const confirmedTickets = tickets.filter(ticket => (ticket.status === 'Payment Confirmed' || ticket.status === 'Ticket sent.'));
      const totalSales = confirmedTickets.reduce((sum, ticket) => {
        const price = parseFloat(ticket.price_per_ticket?.toString() || '0');
        const entries = parseInt(ticket.number_of_entries?.toString() || '1');
        const ticketAmount = price * entries;
        return sum + (isNaN(ticketAmount) ? 0 : ticketAmount);
      }, 0);

      // Calculate ticket counts
      const ticketsSold = confirmedTickets.reduce((sum, ticket) => {
        const entries = parseInt(ticket.number_of_entries?.toString() || '1');
        return sum + (isNaN(entries) ? 0 : entries);
      }, 0);
      
      // Calculate total tickets (all tickets regardless of status)
      const totalTickets = tickets.reduce((sum, ticket) => {
        const entries = parseInt(ticket.number_of_entries?.toString() || '1');
        return sum + (isNaN(entries) ? 0 : entries);
      }, 0);
      
      // Calculate total checked in from all confirmed tickets
      const totalCheckedIn = confirmedTickets.reduce((sum, ticket) => {
        const checkedIn = parseInt(ticket.number_of_claimed_entries?.toString() || '0');
        return sum + (isNaN(checkedIn) ? 0 : checkedIn);
      }, 0);
      
      return {
        id: event.id,
        name: event.title || 'Untitled Event',
        location: event.venue || 'TBA',
        date: event.date_and_time,
        total_sales: isNaN(totalSales) ? 0 : totalSales,
        tickets_sold: isNaN(ticketsSold) ? 0 : ticketsSold,
        total_tickets: isNaN(totalTickets) ? 0 : totalTickets,
        total_checked_in: isNaN(totalCheckedIn) ? 0 : totalCheckedIn
      };
    })
  );
}

// Get fundraiser donations data for dashboard
async function getFundraiserDonationsData(req: AuthRequest) {
  const fundraisers = await Fundraiser.findAll({
    where: { brand_id: req.user.brand_id },
    order: [['id', 'DESC']],
    limit: 5
  });

  return await Promise.all(
    fundraisers.map(async (fundraiser) => {
      const donations = await Donation.findAll({
        where: {
          fundraiser_id: fundraiser.id,
          payment_status: 'paid'
        },
        attributes: ['amount']
      });

      const totalRaised = donations.reduce((sum, donation) => {
        const amount = parseFloat(donation.amount?.toString() || '0');
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

      const donorCount = donations.length;

      return {
        id: fundraiser.id,
        name: fundraiser.title || 'Untitled Fundraiser',
        status: fundraiser.status || 'draft',
        total_raised: isNaN(totalRaised) ? 0 : totalRaised,
        donor_count: donorCount
      };
    })
  );
}

// Get campaigns dashboard data (admin only) - includes both events and fundraisers
export const getEventsDashboardData = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const brandFilter = { brand_id: req.user.brand_id };
    const { Op } = require('sequelize');

    // Get active events count (published events that haven't ended yet).
    // If close_time is set, use that; otherwise fall back to date_and_time.
    const now = new Date();
    const activeEventsCount = await Event.count({
      where: {
        ...brandFilter,
        status: 'published',
        [Op.or]: [
          { close_time: { [Op.gt]: now } },
          { close_time: null, date_and_time: { [Op.gt]: now } }
        ]
      }
    });

    // Get active fundraisers count
    const activeFundraisersCount = await Fundraiser.count({
      where: {
        ...brandFilter,
        status: 'published'
      }
    });

    // Get all events for this brand (used by graphs)
    const allEvents = await Event.findAll({
      where: brandFilter,
      attributes: ['id']
    });

    const allEventIds = allEvents.map(e => e.id);

    // Get active event IDs (published and not yet ended) for quick stats
    const activeEventIds = allEvents.length > 0
      ? (await Event.findAll({
          where: {
            ...brandFilter,
            status: 'published',
            [Op.or]: [
              { close_time: { [Op.gt]: now } },
              { close_time: null, date_and_time: { [Op.gt]: now } }
            ]
          },
          attributes: ['id']
        })).map(e => e.id)
      : [];

    // Get total confirmed ticket sales for active events (all time)
    let activeEventsSales = 0;
    if (activeEventIds.length > 0) {
      const tickets = await Ticket.findAll({
        where: {
          event_id: activeEventIds,
          status: ['Payment Confirmed', 'Ticket sent.']
        },
        attributes: ['price_per_ticket', 'number_of_entries']
      });

      activeEventsSales = tickets.reduce((sum, ticket) => {
        const price = parseFloat(ticket.price_per_ticket?.toString() || '0');
        const entries = parseInt(ticket.number_of_entries?.toString() || '1');
        return sum + (price * entries);
      }, 0);
    }

    // Get total donations for active fundraisers
    const activeFundraisers = await Fundraiser.findAll({
      where: { ...brandFilter, status: 'published' },
      attributes: ['id']
    });

    const activeFundraiserIds = activeFundraisers.map(f => f.id);

    let activeFundraisersDonations = 0;
    if (activeFundraiserIds.length > 0) {
      const donations = await Donation.findAll({
        where: {
          fundraiser_id: activeFundraiserIds,
          payment_status: 'paid'
        },
        attributes: ['amount']
      });

      activeFundraisersDonations = donations.reduce((sum, donation) => {
        const amount = parseFloat(donation.amount?.toString() || '0');
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
    }

    // Get ongoing (published) fundraisers — return first 2 with total raised + total count
    const [ongoingFundraisersRaw, totalOngoingFundraisers] = await Promise.all([
      Fundraiser.findAll({
        where: { ...brandFilter, status: 'published' },
        order: [['id', 'DESC']],
        limit: 2,
        attributes: ['id', 'title', 'poster_url']
      }),
      Fundraiser.count({ where: { ...brandFilter, status: 'published' } })
    ]);

    const ongoingFundraisersItems = await Promise.all(
      ongoingFundraisersRaw.map(async (f) => {
        const donations = await Donation.findAll({
          where: { fundraiser_id: f.id, payment_status: 'paid' },
          attributes: ['amount']
        });
        const totalRaised = donations.reduce((sum, d) => {
          const amount = parseFloat(d.amount?.toString() || '0');
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0);
        return {
          id: f.id,
          title: f.title,
          poster_url: f.poster_url || null,
          total_raised: totalRaised
        };
      })
    );

    const ongoingFundraisers = {
      items: ongoingFundraisersItems,
      total: totalOngoingFundraisers
    };

    // Get upcoming published events (nearest 3 with future date)
    const upcomingEventsRaw = await Event.findAll({
      where: {
        ...brandFilter,
        status: 'published',
        date_and_time: { [Op.gt]: now }
      },
      order: [['date_and_time', 'ASC']],
      limit: 3,
      attributes: ['id', 'title', 'date_and_time', 'venue', 'poster_url', 'status']
    });

    const paidStatuses = ['Payment Confirmed', 'Ticket sent.'];
    const upcomingEvents = await Promise.all(
      upcomingEventsRaw.map(async (e) => {
        const tickets = await Ticket.findAll({
          where: { event_id: e.id, status: paidStatuses },
          attributes: ['number_of_entries', 'price_per_ticket', 'payment_processing_fee', 'platform_fee']
        });
        const ticketsSold = tickets.reduce((sum, t) => sum + (t.number_of_entries || 0), 0);
        const netEarnings = tickets.reduce((sum, t) => {
          const gross = (t.price_per_ticket || 0) * (t.number_of_entries || 0);
          return sum + gross - (t.platform_fee || 0);
        }, 0);
        return {
          id: e.id,
          title: e.title,
          date_and_time: e.date_and_time,
          venue: e.venue,
          poster_url: e.poster_url || null,
          tickets_sold: ticketsSold,
          net_earnings: netEarnings
        };
      })
    );

    // Get event sales and fundraiser donations data (reuse existing functions)
    const [eventSales, fundraiserDonations] = await Promise.all([
      getEventSalesData(req),
      getFundraiserDonationsData(req)
    ]);

    res.json({
      user: {
        firstName: req.user.first_name,
        isAdmin: req.user.is_admin
      },
      stats: {
        activeEvents: activeEventsCount,
        activeFundraisers: activeFundraisersCount,
        activeEventsSales: activeEventsSales,
        activeFundraisersDonations: activeFundraisersDonations
      },
      ongoingFundraisers,
      upcomingEvents,
      eventSales,
      fundraiserDonations
    });
  } catch (error) {
    console.error('Get events dashboard data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function getDashboardStatsData(req: AuthRequest, artistId: number | null = null) {
  let artistFilter: number[] | null = null;
  const brandFilter = { brand_id: req.user.brand_id };

  if (!req.user.is_admin) {
    const artistAccess = await ArtistAccess.findAll({
      where: { user_id: req.user.id, status: 'Accepted' },
      attributes: ['artist_id']
    });
    const accessibleIds = artistAccess.map(access => access.artist_id);
    if (accessibleIds.length === 0) return { totalReleases: 0 };
    artistFilter = artistId ? accessibleIds.filter(id => id === artistId) : accessibleIds;
    if (artistFilter.length === 0) return { totalReleases: 0 };
  } else if (artistId) {
    artistFilter = [artistId];
  }

  const countReleases = (extraWhere: object) => {
    if (!artistFilter) {
      return Release.count({ where: { ...brandFilter, ...extraWhere } });
    }
    return Release.count({
      where: { ...brandFilter, ...extraWhere },
      include: [{
        model: ReleaseArtist,
        as: 'releaseArtists',
        where: { artist_id: artistFilter },
        required: true
      }]
    });
  };

  const { Op } = require('sequelize');
  const [totalReleases, unreleasedCount] = await Promise.all([
    countReleases({}),
    countReleases({ status: { [Op.in]: ['Draft', 'For Submission', 'Pending'] } })
  ]);

  return { totalReleases, unreleasedCount };
}

async function getReleasePipelineData(req: AuthRequest) {
  const STATUSES = ['Draft', 'For Submission', 'Pending', 'Live', 'Taken Down'];
  const brandFilter = { brand_id: req.user.brand_id };
  const counts: Record<string, number> = Object.fromEntries(STATUSES.map(s => [s, 0]));

  let releases: any[];

  if (!req.user.is_admin) {
    const artistAccess = await ArtistAccess.findAll({
      where: { user_id: req.user.id, status: 'Accepted' },
      attributes: ['artist_id']
    });
    const accessibleArtistIds = artistAccess.map((a: any) => a.artist_id);

    if (accessibleArtistIds.length === 0) {
      return STATUSES.map(status => ({ status, count: 0 }));
    }

    releases = await Release.findAll({
      where: brandFilter,
      attributes: ['id', 'status'],
      include: [{
        model: ReleaseArtist,
        as: 'releaseArtists',
        attributes: ['artist_id'],
        where: { artist_id: accessibleArtistIds },
        required: true
      }]
    });
  } else {
    releases = await Release.findAll({
      where: brandFilter,
      attributes: ['id', 'status']
    });
  }

  // Deduplicate by release ID — a release with multiple artists
  // appears once per artist in the JOIN result.
  const seenIds = new Set<number>();
  releases.forEach((r: any) => {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      if (counts[r.status] !== undefined) counts[r.status]++;
    }
  });

  return STATUSES.map(status => ({ status, count: counts[status] }));
}

async function getChecklistData(req: AuthRequest, artistId: number | null = null) {
  const empty = { hasProfile: false, hasGalleryPhotos: false, hasSettlementAccount: false, hasRelease: false };

  // Resolve artistId for non-admin users if not provided
  let resolvedId = artistId;
  if (!resolvedId && !req.user.is_admin) {
    const access = await ArtistAccess.findOne({
      where: { user_id: req.user.id, status: 'Accepted' },
      attributes: ['artist_id']
    });
    if (access) resolvedId = access.artist_id;
  }
  if (!resolvedId) return empty;

  const artist = await Artist.findOne({
    where: { id: resolvedId, brand_id: req.user.brand_id },
    attributes: ['id', 'bio']
  });
  if (!artist) return empty;

  const [galleryCount, paymentMethodCount, releaseCount] = await Promise.all([
    ArtistImage.count({ where: { artist_id: resolvedId } }),
    PaymentMethod.count({ where: { artist_id: resolvedId } }),
    Release.count({
      where: { brand_id: req.user.brand_id },
      include: [{
        model: ReleaseArtist,
        as: 'releaseArtists',
        where: { artist_id: resolvedId },
        required: true
      }]
    })
  ]);

  return {
    hasProfile: !!(artist.bio && artist.bio.trim()),
    hasGalleryPhotos: galleryCount > 0,
    hasSettlementAccount: paymentMethodCount > 0,
    hasRelease: releaseCount > 0
  };
}

async function getLatestEarningData(req: AuthRequest, artistId: number | null = null) {
  let artistFilter: number[] | null = null;

  if (!req.user.is_admin) {
    const artistAccess = await ArtistAccess.findAll({
      where: { user_id: req.user.id, status: 'Accepted' },
      attributes: ['artist_id']
    });
    const accessibleIds = artistAccess.map((a: any) => a.artist_id);
    if (accessibleIds.length === 0) return null;
    artistFilter = artistId ? accessibleIds.filter((id: number) => id === artistId) : accessibleIds;
    if (artistFilter.length === 0) return null;
  } else if (artistId) {
    artistFilter = [artistId];
  }

  // Find all release IDs for this artist
  const releaseWhere: any = { brand_id: req.user.brand_id };
  let releaseIds: number[];

  if (artistFilter) {
    const releases = await Release.findAll({
      where: releaseWhere,
      attributes: ['id'],
      include: [{
        model: ReleaseArtist,
        as: 'releaseArtists',
        where: { artist_id: artistFilter },
        required: true,
        attributes: []
      }]
    });
    releaseIds = releases.map((r: any) => r.id);
    if (releaseIds.length === 0) return null;
  } else {
    const releases = await Release.findAll({ where: releaseWhere, attributes: ['id'] });
    releaseIds = releases.map((r: any) => r.id);
    if (releaseIds.length === 0) return null;
  }

  const earning = await Earning.findOne({
    where: { release_id: releaseIds },
    include: [{ model: Release, as: 'release', attributes: ['id', 'title'] }],
    order: [['date_recorded', 'DESC']]
  });

  if (!earning) return null;

  return {
    amount: parseFloat(earning.amount?.toString() || '0'),
    date_recorded: earning.date_recorded,
    type: earning.type,
    release_id: earning.release_id,
    release_title: (earning as any).release?.title || null
  };
}

async function getLatestReleaseWithEarnings(req: AuthRequest, artistId: number | null = null) {
  let artistFilter: number[] | null = null;

  if (!req.user.is_admin) {
    const artistAccess = await ArtistAccess.findAll({
      where: { user_id: req.user.id, status: 'Accepted' },
      attributes: ['artist_id']
    });
    const accessibleIds = artistAccess.map((a: any) => a.artist_id);
    if (accessibleIds.length === 0) return null;
    artistFilter = artistId ? accessibleIds.filter((id: number) => id === artistId) : accessibleIds;
    if (artistFilter.length === 0) return null;
  } else if (artistId) {
    artistFilter = [artistId];
  }

  const releaseQuery: any = {
    where: { brand_id: req.user.brand_id },
    include: [
      {
        model: ReleaseArtist,
        as: 'releaseArtists',
        include: [{ model: Artist, as: 'artist' }],
        ...(artistFilter ? { where: { artist_id: artistFilter }, required: true } : {})
      },
      { model: Earning, as: 'earnings', required: false }
    ],
    order: [['release_date', 'DESC']],
    limit: 1
  };

  releaseQuery.where.status = 'Live';

  const release = await Release.findOne(releaseQuery);
  if (!release) return null;

  const primaryArtist = release.releaseArtists?.[0]?.artist || null;
  const netEarnings = release.earnings?.reduce((sum: number, e: any) => {
    return sum + (parseFloat(e.amount?.toString() || '0'));
  }, 0) || 0;

  return {
    id: release.id,
    catalog_no: release.catalog_no,
    title: release.title,
    release_date: release.release_date,
    cover_art: release.cover_art || null,
    status: release.status,
    artist_id: primaryArtist?.id || null,
    artist_name: primaryArtist?.name || 'Unknown Artist',
    net_earnings: netEarnings
  };
}

async function getRecentArtistsData(req: AuthRequest) {
  const artists = await Artist.findAll({
    where: { brand_id: req.user.brand_id },
    attributes: ['id', 'name', 'profile_photo'],
    order: [['updatedAt', 'DESC']],
    limit: 4
  });

  return artists.map(artist => ({
    id: artist.id,
    name: artist.name,
    profile_photo: artist.profile_photo || null
  }));
}