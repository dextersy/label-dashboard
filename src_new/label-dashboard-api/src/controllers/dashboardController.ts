import { Request, Response } from 'express';
import { Release, Artist, Earning, Royalty, Payment, Event, Ticket, ReleaseArtist, ArtistAccess } from '../models';

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
          where: { artist_id: artist.id }
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
    const [latestReleases, topEarningReleases, balanceSummary, stats] = await Promise.all([
      getLatestReleasesData(req),
      getTopEarningReleasesData(req),
      getBalanceSummaryData(req),
      getDashboardStatsData(req)
    ]);

    const dashboardData: any = {
      user: {
        firstName: req.user.first_name,
        isAdmin: req.user.is_admin
      },
      latestReleases,
      topEarningReleases,
      balanceSummary,
      stats
    };

    // Add event sales for admin users
    if (req.user.is_admin) {
      const eventSales = await getEventSalesData(req);
      dashboardData.eventSales = eventSales;
    }

    res.json(dashboardData);
  } catch (error) {
    console.error('Get dashboard data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper functions to get data without response
async function getLatestReleasesData(req: AuthRequest) {
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
    limit: 5
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
      return []; // No accessible artists, return empty array
    }

    // Filter releases to only include those with accessible artists
    releaseQuery.include[0].where = {
      artist_id: accessibleArtistIds
    };
    releaseQuery.include[0].required = true;
  }

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

async function getTopEarningReleasesData(req: AuthRequest) {
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
      },
      {
        model: Earning,
        as: 'earnings',
        required: false
      }
    ]
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
      return []; // No accessible artists, return empty array
    }

    // Filter releases to only include those with accessible artists
    releaseQuery.include[0].where = {
      artist_id: accessibleArtistIds
    };
    releaseQuery.include[0].required = true;
  }

  const releases = await Release.findAll(releaseQuery);

  // Calculate total earnings for each release and sort by total earnings
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
    .slice(0, 5); // Take top 5 after sorting by total earnings
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
        where: { artist_id: artist.id }
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

async function getDashboardStatsData(req: AuthRequest) {
  let statsQuery = {};
  let accessibleArtistIds: number[] = [];

  // For non-admin users, get accessible artist IDs first
  if (!req.user.is_admin) {
    const artistAccess = await ArtistAccess.findAll({
      where: { 
        user_id: req.user.id,
        status: 'Accepted'
      },
      attributes: ['artist_id']
    });
    
    accessibleArtistIds = artistAccess.map(access => access.artist_id);
    
    if (accessibleArtistIds.length === 0) {
      return {
        latestRelease: null,
        totalArtists: 0,
        totalReleases: 0
      };
    }
  }

  const brandFilter = { brand_id: req.user.brand_id };

  // Get latest release with artist info
  let latestReleaseQuery: any = {
    where: brandFilter,
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
    limit: 1
  };

  // For non-admin users, filter by accessible artists
  if (!req.user.is_admin && accessibleArtistIds.length > 0) {
    latestReleaseQuery.include[0].where = {
      artist_id: accessibleArtistIds
    };
    latestReleaseQuery.include[0].required = true;
  }

  const latestReleaseResult = await Release.findOne(latestReleaseQuery);

  let latestRelease = null;
  if (latestReleaseResult) {
    const primaryArtist = latestReleaseResult.releaseArtists && latestReleaseResult.releaseArtists.length > 0 
      ? latestReleaseResult.releaseArtists[0].artist 
      : null;
    latestRelease = {
      id: latestReleaseResult.id,
      catalog_no: latestReleaseResult.catalog_no,
      title: latestReleaseResult.title,
      artist_id: primaryArtist?.id || null,
      artist_name: primaryArtist?.name || 'Unknown Artist'
    };
  }

  // Get total counts
  let totalArtists, totalReleases;

  if (req.user.is_admin) {
    // Admin can see all artists and releases in their brand
    [totalArtists, totalReleases] = await Promise.all([
      Artist.count({ where: brandFilter }),
      Release.count({ where: brandFilter })
    ]);
  } else {
    // Non-admin users see only accessible data
    if (accessibleArtistIds.length === 0) {
      totalArtists = 0;
      totalReleases = 0;
    } else {
      totalArtists = accessibleArtistIds.length;
      
      // Count releases for accessible artists
      totalReleases = await Release.count({
        where: brandFilter,
        include: [
          {
            model: ReleaseArtist,
            as: 'releaseArtists',
            where: {
              artist_id: accessibleArtistIds
            },
            required: true
          }
        ]
      });
    }
  }

  return {
    latestRelease,
    totalArtists,
    totalReleases
  };
}