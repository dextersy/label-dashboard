import { Request, Response } from 'express';
import { Earning, Royalty, Payment, PaymentMethod, Artist, Release, RecuperableExpense, ReleaseArtist, Brand, ArtistAccess, User } from '../models';
import { sendEarningsNotification, sendPaymentNotification } from '../utils/emailService';
import { PaymentService } from '../utils/paymentService';
import { calculatePlatformFeeForMusicEarnings } from '../utils/platformFeeCalculator';
import csv from 'csv-parser';
import * as fuzz from 'fuzzball';
import { Readable } from 'stream';

interface AuthRequest extends Request {
  user?: any;
}

// EARNINGS MANAGEMENT
export const addEarning = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      release_id,
      type,
      amount,
      description,
      date_recorded,
      calculate_royalties = false
    } = req.body;

    if (!release_id || !amount || !date_recorded) {
      return res.status(400).json({ 
        error: 'Release ID, amount, and date are required' 
      });
    }

    // Verify release exists and belongs to user's brand
    const release = await Release.findOne({
      where: { 
        id: release_id,
        brand_id: req.user.brand_id 
      }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Create earning record with 0 platform fee initially (will be calculated after processing)
    const earning = await Earning.create({
      release_id,
      type: type || 'Streaming',
      amount: parseFloat(amount.toFixed(2)),
      description,
      date_recorded: new Date(date_recorded),
      platform_fee: 0
    });

    // Process recuperable expenses and royalties if requested
    let recuperationInfo = null;
    if (calculate_royalties) {
      // Process both recuperable expenses and royalties
      recuperationInfo = await processEarningRoyalties(earning);
      
      // Calculate and set the final platform fee
      const grossAmount = parseFloat(amount.toFixed(2));
      const finalPlatformFeeCalc = await calculatePlatformFeeForMusicEarnings(
        req.user.brand_id,
        grossAmount,
        Math.max(0, grossAmount - (recuperationInfo?.recuperatedAmount || 0) - (recuperationInfo?.totalRoyalties || 0))
      );
      
      // Update the earning with the final platform fee
      await earning.update({
        platform_fee: finalPlatformFeeCalc.totalPlatformFee
      });
    }

    // Send earning notification emails (matching PHP logic)
    await sendEarningNotifications(earning, req.user.brand_id, recuperationInfo);

    res.status(201).json({
      message: 'Earning added successfully',
      earning
    });
  } catch (error) {
    console.error('Add earning error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const bulkAddEarnings = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { earnings } = req.body; // Array of earning objects

    if (!Array.isArray(earnings) || earnings.length === 0) {
      return res.status(400).json({ error: 'Earnings array is required' });
    }

    const createdEarnings = [];
    const errors = [];

    for (let i = 0; i < earnings.length; i++) {
      try {
        const earningData = earnings[i];
        
        // Verify release exists
        const release = await Release.findOne({
          where: { 
            id: earningData.release_id,
            brand_id: req.user.brand_id 
          }
        });

        if (!release) {
          errors.push(`Row ${i + 1}: Release not found`);
          continue;
        }

        // Create earning record with 0 platform fee initially (will be calculated after processing)
        const earning = await Earning.create({
          release_id: earningData.release_id,
          type: earningData.type || 'Streaming',
          amount: parseFloat(earningData.amount.toFixed(2)),
          description: earningData.description,
          date_recorded: new Date(earningData.date_recorded),
          platform_fee: 0
        });

        // Process recuperable expenses and royalties if requested
        let recuperationInfo = null;
        if (earningData.calculate_royalties) {
          // Process both recuperable expenses and royalties
          recuperationInfo = await processEarningRoyalties(earning);
          
          // Calculate and set the final platform fee
          const grossAmount = parseFloat(earningData.amount.toFixed(2));
          const finalPlatformFeeCalc = await calculatePlatformFeeForMusicEarnings(
            req.user.brand_id,
            grossAmount,
            Math.max(0, grossAmount - (recuperationInfo?.recuperatedAmount || 0) - (recuperationInfo?.totalRoyalties || 0))
          );
          
          // Update the earning with the final platform fee
          await earning.update({
            platform_fee: finalPlatformFeeCalc.totalPlatformFee
          });
        }

        // Send earning notification emails (matching PHP logic)
        await sendEarningNotifications(earning, req.user.brand_id, recuperationInfo);

        createdEarnings.push(earning);
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    res.json({
      message: `Processed ${earnings.length} earnings`,
      created: createdEarnings.length,
      errors
    });
  } catch (error) {
    console.error('Bulk add earnings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

interface CsvRow {
  [key: string]: string;
}

interface ProcessedEarningRow {
  original_data: CsvRow;
  catalog_no: string;
  release_title: string;
  earning_amount: number;
  matched_release: {
    id: number;
    catalog_no: string;
    title: string;
  } | null;
  fuzzy_match_score?: number;
}

// Fuzzy match column headers to expected fields
const fuzzyMatchColumns = (headers: string[]): { [key: string]: string } => {
  const expectedFields = {
    catalog_no: ['catalog', 'catalog_no', 'catalog_number', 'cat_no', 'catno'],
    release_title: ['title', 'release_title', 'release', 'album', 'song'],
    earning_amount: ['amount', 'earning_amount', 'earnings', 'revenue', 'total']
  };

  const columnMapping: { [key: string]: string } = {};

  Object.keys(expectedFields).forEach(field => {
    const candidates = expectedFields[field];
    let bestMatch = '';
    let bestScore = 0;

    headers.forEach(header => {
      candidates.forEach(candidate => {
        const score = fuzz.ratio(header.toLowerCase().trim(), candidate.toLowerCase());
        if (score > bestScore && score >= 60) { // 60% similarity threshold
          bestScore = score;
          bestMatch = header;
        }
      });
    });

    if (bestMatch) {
      columnMapping[field] = bestMatch;
    }
  });

  return columnMapping;
};

// Find exact matching release for a given catalog number and title
const findMatchingRelease = async (
  releases: Release[], 
  catalogNo: string, 
  releaseTitle: string
): Promise<{ release: Release | null; score: number }> => {
  // Determine which fields are available for matching
  const hasCatalogNo = catalogNo && catalogNo.trim() !== '';
  const hasReleaseTitle = releaseTitle && releaseTitle.trim() !== '';

  // If neither field is provided, no match is possible
  if (!hasCatalogNo && !hasReleaseTitle) {
    return { release: null, score: 0 };
  }

  // Step 1: If catalog number is present, use that for exact matching
  if (hasCatalogNo) {
    const catalogMatches = releases.filter(release => 
      (release.catalog_no || '').toLowerCase().trim() === catalogNo.toLowerCase().trim()
    );
    
    if (catalogMatches.length === 1) {
      return { release: catalogMatches[0], score: 100 };
    } else if (catalogMatches.length > 1) {
      // Multiple catalog matches - this shouldn't happen but if it does, take the first one
      return { release: catalogMatches[0], score: 100 };
    }
    // If no catalog match found, don't fall back to title matching
    return { release: null, score: 0 };
  }

  // Step 2: If no catalog number provided, use release title for exact matching
  if (hasReleaseTitle) {
    const titleMatches = releases.filter(release => 
      (release.title || '').toLowerCase().trim() === releaseTitle.toLowerCase().trim()
    );
    
    if (titleMatches.length === 1) {
      return { release: titleMatches[0], score: 100 };
    } else if (titleMatches.length > 1) {
      // Multiple title matches - consider unmatched as requested
      console.log(`MULTIPLE TITLE MATCHES for "${releaseTitle}": Found ${titleMatches.length} releases with same title`);
      return { release: null, score: 0 };
    } else {
      console.log(`NO TITLE MATCH for "${releaseTitle}": No exact match found in ${releases.length} releases`);
    }
  }

  return { release: null, score: 0 };
};

export const previewCsvForEarnings = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    // Get all releases for the brand
    const releases = await Release.findAll({
      where: { brand_id: req.user.brand_id }
    });

    const csvData: CsvRow[] = [];
    const processedRows: ProcessedEarningRow[] = [];

    // Parse CSV file
    const csvContent = req.file.buffer.toString();
    const stream = Readable.from(csvContent);

    return new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data: CsvRow) => {
          csvData.push(data);
        })
        .on('end', async () => {
          try {
            if (csvData.length === 0) {
              return res.status(400).json({ error: 'CSV file is empty' });
            }

            // Get headers and perform fuzzy matching
            const headers = Object.keys(csvData[0]);
            const columnMapping = fuzzyMatchColumns(headers);

            if (!columnMapping.earning_amount) {
              return res.status(400).json({ 
                error: 'Could not identify earning amount column. Expected columns like: amount, earning_amount, earnings, revenue, total' 
              });
            }

            let totalMatchedAmount = 0;
            let unmatchedCount = 0;

            // Process each row
            for (const row of csvData) {
              const catalogNo = columnMapping.catalog_no ? (row[columnMapping.catalog_no] || '').trim() : '';
              const releaseTitle = columnMapping.release_title ? (row[columnMapping.release_title] || '').trim() : '';
              const earningAmountStr = row[columnMapping.earning_amount] || '0';
              
              // Parse earning amount
              const earningAmount = parseFloat(earningAmountStr.replace(/[^\d.-]/g, ''));
              
              if (isNaN(earningAmount)) {
                continue; // Skip rows with invalid amounts
              }

              const processedRow: ProcessedEarningRow = {
                original_data: row,
                catalog_no: catalogNo,
                release_title: releaseTitle,
                earning_amount: earningAmount,
                matched_release: null
              };

              // Try to find matching release
              if (catalogNo || releaseTitle) {
                const { release, score } = await findMatchingRelease(releases, catalogNo, releaseTitle);
                if (release) {
                  processedRow.matched_release = {
                    id: release.id,
                    catalog_no: release.catalog_no || '',
                    title: release.title || ''
                  };
                  processedRow.fuzzy_match_score = score;
                  // Only add to total if there's a match
                  totalMatchedAmount += earningAmount;
                } else {
                  unmatchedCount++;
                  // Log unmatched entries for debugging
                  console.log('UNMATCHED ROW:', {
                    catalog_no: catalogNo || '(not provided)',
                    release_title: releaseTitle || '(not provided)',
                    earning_amount: earningAmount,
                    reason: catalogNo ? 'No exact catalog match found' : 
                            releaseTitle ? 'No unique title match found' : 'No identifiers provided'
                  });
                }
              } else {
                unmatchedCount++;
                console.log('UNMATCHED ROW: No catalog number or release title provided');
              }

              processedRows.push(processedRow);
            }

            const summary = {
              total_rows: processedRows.length,
              total_unmatched: unmatchedCount,
              total_earning_amount: parseFloat(totalMatchedAmount.toFixed(2)),
              column_mapping: columnMapping
            };

            res.json({
              message: 'CSV processed successfully',
              data: processedRows,
              summary
            });

          } catch (error) {
            console.error('CSV processing error:', error);
            res.status(500).json({ error: 'Error processing CSV file' });
          }
        })
        .on('error', (error) => {
          console.error('CSV parsing error:', error);
          res.status(500).json({ error: 'Error parsing CSV file' });
        });
    });

  } catch (error) {
    console.error('Preview CSV for earnings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Helper function to process earning royalties with recuperable expense handling
async function processEarningRoyalties(earning: any) {
  // Get the release to find the brand_id
  const release = await Release.findByPk(earning.release_id);
  if (!release) {
    throw new Error('Release not found');
  }

  // Calculate current recuperable expense balance for this release
  const recuperableExpenses = await RecuperableExpense.findAll({
    where: { 
      release_id: earning.release_id,
      brand_id: release.brand_id 
    }
  });

  const recuperableBalance = recuperableExpenses.reduce(
    (sum, expense) => sum + parseFloat((expense.expense_amount || 0).toString()), 
    0
  );

  let remainingEarningAmount = earning.amount;
  let recuperatedAmount = 0;

  // If there are recuperable expenses remaining, deduct from them first
  if (recuperableBalance > 0) {
    if (earning.amount >= recuperableBalance) {
      // Earning covers all remaining recuperable expenses
      recuperatedAmount = recuperableBalance;
      remainingEarningAmount = earning.amount - recuperableBalance;
    } else {
      // Earning partially covers recuperable expenses
      recuperatedAmount = earning.amount;
      remainingEarningAmount = 0;
    }

    // Create negative recuperable expense entry to track the deduction
    if (recuperatedAmount > 0) {
      await RecuperableExpense.create({
        release_id: earning.release_id,
        brand_id: release.brand_id,
        expense_description: `Recuperated from ${earning.type}`,
        expense_amount: -recuperatedAmount, // Negative value to reduce balance
        date_recorded: earning.date_recorded
      });
    }
  }

  // Only calculate royalties on the remaining amount after recuperable expense deduction
  let totalRoyalties = 0;
  
  if (remainingEarningAmount > 0) {
    const releaseArtists = await ReleaseArtist.findAll({
      where: { release_id: earning.release_id },
      include: [{ model: Artist, as: 'artist' }]
    });

    for (const releaseArtist of releaseArtists) {
      let royaltyPercentage = 0;
      
      // Get royalty percentage based on earning type
      switch (earning.type) {
        case 'Streaming':
          royaltyPercentage = releaseArtist.streaming_royalty_percentage;
          break;
        case 'Sync':
          royaltyPercentage = releaseArtist.sync_royalty_percentage;
          break;
        case 'Downloads':
          royaltyPercentage = releaseArtist.download_royalty_percentage;
          break;
        case 'Physical':
          royaltyPercentage = releaseArtist.physical_royalty_percentage;
          break;
      }

      if (royaltyPercentage > 0) {
        const royaltyAmount = parseFloat((remainingEarningAmount * royaltyPercentage).toFixed(2));
        
        await Royalty.create({
          artist_id: releaseArtist.artist_id,
          earning_id: earning.id,
          release_id: earning.release_id,
          percentage_of_earning: royaltyPercentage,
          amount: royaltyAmount,
          description: `${earning.type} royalty from ${earning.description || 'earning'} (after recuperable expense deduction)`,
          date_recorded: earning.date_recorded
        });
        
        // Track total royalties applied
        totalRoyalties += royaltyAmount;
      }
    }
  }

  // Return recuperation and royalty info
  return {
    recuperatedAmount,
    remainingRecuperableBalance: Math.max(0, recuperableBalance - recuperatedAmount),
    totalRoyalties: parseFloat(totalRoyalties.toFixed(2))
  };
}

// ROYALTY MANAGEMENT
export const addRoyalty = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      artist_id,
      earning_id,
      release_id,
      amount,
      description,
      date_recorded
    } = req.body;

    if (!artist_id || !amount || !date_recorded) {
      return res.status(400).json({ 
        error: 'Artist ID, amount, and date are required' 
      });
    }

    // Verify artist belongs to user's brand
    const artist = await Artist.findOne({
      where: { 
        id: artist_id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const royalty = await Royalty.create({
      artist_id,
      earning_id,
      release_id,
      amount,
      description,
      date_recorded: new Date(date_recorded)
    });

    res.status(201).json({
      message: 'Royalty added successfully',
      royalty
    });
  } catch (error) {
    console.error('Add royalty error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRoyalties = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id, release_id, page = '1', limit = '20', sortBy, sortDirection, start_date, end_date, ...filters } = req.query;
    const artistIdNum = artist_id ? parseInt(artist_id as string, 10) : undefined;
    const releaseIdNum = release_id ? parseInt(release_id as string, 10) : undefined;

    const where: any = {};
    
    // Build release where clause for title filtering
    const releaseWhere: any = {};
    
    if (filters.release_title && filters.release_title !== '') {
      releaseWhere.title = { [require('sequelize').Op.like]: `%${filters.release_title}%` };
    }
    
    const includeConditions: any[] = [
      { model: Artist, as: 'artist', where: { brand_id: req.user.brand_id } },
      { model: Release, as: 'release', where: releaseWhere } // Include release with filtering
    ];

    if (artist_id) {
      where.artist_id = artistIdNum;
    }

    if (release_id) {
      where.release_id = releaseIdNum;
    }

    // Add date range filtering
    if (start_date && end_date) {
      where.date_recorded = {
        [require('sequelize').Op.between]: [start_date, end_date]
      };
    } else if (filters.date_recorded && filters.date_recorded !== '') {
      // Fallback for single date search (exact match for the day)
      const searchDate = new Date(filters.date_recorded as string);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      where.date_recorded = {
        [require('sequelize').Op.gte]: searchDate,
        [require('sequelize').Op.lt]: nextDay
      };
    }

    // Add search filters
    if (filters.description && filters.description !== '') {
      where.description = { [require('sequelize').Op.like]: `%${filters.description}%` };
    }
    
    if (filters.amount && filters.amount !== '') {
      where.amount = parseFloat(filters.amount as string);
    }

    // Build order clause
    let orderClause: any[] = [['date_recorded', 'DESC']]; // Default order
    
    if (sortBy && sortDirection) {
      const validSortColumns = ['date_recorded', 'description', 'amount'];
      const validDirections = ['asc', 'desc'];
      
      if (validSortColumns.includes(sortBy as string) && validDirections.includes((sortDirection as string).toLowerCase())) {
        orderClause = [[sortBy as string, (sortDirection as string).toUpperCase()]];
      }
    }

    const pageNum = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const offset = (pageNum - 1) * pageSize;

    const { count, rows: royalties } = await Royalty.findAndCountAll({
      where,
      include: includeConditions,
      order: orderClause,
      limit: pageSize,
      offset: offset
    });

    const totalPages = Math.ceil(count / pageSize);

    res.json({ 
      royalties,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: count,
        per_page: pageSize,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get royalties error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all earnings
export const getEarnings = async (req: AuthRequest, res: Response) => {
  try {
    const { release_id, type, page = '1', limit = '20' } = req.query;
    const releaseIdNum = release_id ? parseInt(release_id as string, 10) : undefined;

    const where: any = {};
    if (release_id) {
      where.release_id = releaseIdNum;
    }
    if (type) {
      where.type = type;
    }

    const pageNum = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const offset = (pageNum - 1) * pageSize;

    const { count, rows: earnings } = await Earning.findAndCountAll({
      where,
      include: [
        { 
          model: Release, 
          as: 'release',
          where: { brand_id: req.user.brand_id }
        }
      ],
      order: [['date_recorded', 'DESC']],
      limit: pageSize,
      offset: offset
    });

    const totalPages = Math.ceil(count / pageSize);

    res.json({ 
      earnings,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: count,
        per_page: pageSize,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get earning by ID
export const getEarningById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const earning = await Earning.findOne({
      where: { id },
      include: [
        { 
          model: Release, 
          as: 'release',
          where: { brand_id: req.user.brand_id }
        }
      ]
    });

    if (!earning) {
      return res.status(404).json({ error: 'Earning not found' });
    }

    res.json({ earning });
  } catch (error) {
    console.error('Get earning by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get earnings by artist ID
export const getEarningsByArtist = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id } = req.params;
    let artistIdNum = parseInt(artist_id, 10);
    
    if (isNaN(artistIdNum)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    const { type, page = '1', limit = '20', sortBy, sortDirection, start_date, end_date, ...filters } = req.query;
    
    // Verify artist belongs to user's brand
    const artist = await Artist.findOne({
      where: { 
        id: artistIdNum,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Build where clause for earnings
    const earningsWhere: any = {};
    if (type) {
      earningsWhere.type = type;
    }

    // Add date range filtering
    if (start_date && end_date) {
      earningsWhere.date_recorded = {
        [require('sequelize').Op.between]: [start_date, end_date]
      };
    } else if (filters.date_recorded && filters.date_recorded !== '') {
      // Fallback for single date search (exact match for the day)
      const searchDate = new Date(filters.date_recorded as string);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      earningsWhere.date_recorded = {
        [require('sequelize').Op.gte]: searchDate,
        [require('sequelize').Op.lt]: nextDay
      };
    }

    // Add search filters
    if (filters.description && filters.description !== '') {
      earningsWhere.description = { [require('sequelize').Op.like]: `%${filters.description}%` };
    }
    
    if (filters.amount && filters.amount !== '') {
      earningsWhere.amount = parseFloat(filters.amount as string);
    }

    // Build order clause
    let orderClause: any[] = [['date_recorded', 'DESC']]; // Default order
    
    if (sortBy && sortDirection) {
      const validSortColumns = ['date_recorded', 'description', 'amount', 'type'];
      const validDirections = ['asc', 'desc'];
      
      if (validSortColumns.includes(sortBy as string) && validDirections.includes((sortDirection as string).toLowerCase())) {
        orderClause = [[sortBy as string, (sortDirection as string).toUpperCase()]];
      }
    }

    const pageNum = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const offset = (pageNum - 1) * pageSize;

    // Build release where clause for title filtering
    const releaseWhere: any = { brand_id: req.user.brand_id };
    
    if (filters.release_title && filters.release_title !== '') {
      releaseWhere.title = { [require('sequelize').Op.like]: `%${filters.release_title}%` };
    }

    // Get earnings for releases associated with this artist
    const { count, rows: earnings } = await Earning.findAndCountAll({
      where: earningsWhere,
      include: [
        {
          model: Release,
          as: 'release',
          where: releaseWhere,
          include: [
            {
              model: ReleaseArtist,
              as: 'releaseArtists',
              where: { artist_id: artistIdNum },
              include: [
                {
                  model: Artist,
                  as: 'artist'
                }
              ]
            }
          ]
        }
      ],
      order: orderClause,
      limit: pageSize,
      offset: offset
    });

    const totalPages = Math.ceil(count / pageSize);

    res.json({ 
      earnings,
      artist: {
        id: artist.id,
        name: artist.name
      },
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: count,
        per_page: pageSize,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get earnings by artist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PAYMENT MANAGEMENT
export const addPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      artist_id,
      amount,
      description,
      date_paid,
      paid_thru_type,
      paid_thru_account_name,
      paid_thru_account_number,
      payment_method_id,
      reference_number,
      payment_processing_fee,
      send_notification = true
    } = req.body;
    
    const artistIdNum = parseInt(artist_id, 10);

    if (!artist_id || amount === undefined || amount === null || amount <= 0 || !date_paid) {
      return res.status(400).json({ 
        error: 'Artist ID, amount (greater than 0), and date are required' 
      });
    }

    // Verify artist belongs to user's brand
    const artist = await Artist.findOne({
      where: { 
        id: artist_id,
        brand_id: req.user.brand_id 
      },
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    let finalAmount = amount;
    let finalProcessingFee = payment_processing_fee || 0;
    let finalReferenceNumber = reference_number;

    // Handle Paymongo payment processing for non-manual payments
    if (payment_method_id && payment_method_id !== '-1' && req.body.manualPayment !== '1') {
      try {
        const paymentService = new PaymentService();
        const brand = artist.brand;
        
        if (!brand || !brand.paymongo_wallet_id) {
          return res.status(400).json({ error: 'Brand wallet not configured for payments' });
        }

        // Calculate processing fee
        const processingFee = brand.payment_processing_fee_for_payouts || 0;
        const transferAmount = amount - processingFee;

        // Send money through Paymongo
        const referenceNumber = await paymentService.sendMoneyTransfer(
          brand.id,
          payment_method_id,
          transferAmount,
          description
        );

        if (!referenceNumber) {
          return res.status(400).json({ error: 'Payment processing failed' });
        }

        finalProcessingFee = processingFee;
        finalReferenceNumber = referenceNumber;
      } catch (error) {
        console.error('Paymongo payment error:', error);
        return res.status(500).json({ error: 'Payment processing failed' });
      }
    }

    // Create payment object - prioritize payment_method_id over legacy paid_thru_* fields
    const paymentData: any = {
      artist_id: artistIdNum,
      amount: finalAmount,
      description,
      date_paid: new Date(date_paid),
      reference_number: finalReferenceNumber,
      payment_processing_fee: finalProcessingFee
    };

    // Set payment_method_id if provided, otherwise fall back to legacy fields
    if (payment_method_id && payment_method_id !== '-1') {
      paymentData.payment_method_id = payment_method_id;
      // Do not set paid_thru_* fields for new payments with payment_method_id
    } else {
      // Only set legacy fields if no payment_method_id is provided (for backward compatibility)
      paymentData.paid_thru_type = paid_thru_type;
      paymentData.paid_thru_account_name = paid_thru_account_name;
      paymentData.paid_thru_account_number = paid_thru_account_number;
    }

    const payment = await Payment.create(paymentData);

    // Send payment notification if requested
    if (send_notification) {
      // Get artist team members
      const { ArtistAccess, User, Brand } = require('../models');
      const artistAccess = await ArtistAccess.findAll({
        where: { artist_id: artistIdNum },
        include: [{ model: User, as: 'user' }]
      });

      const recipients = artistAccess.map(access => access.user.email_address);

      if (recipients.length > 0) {
        // Get brand info for proper email formatting
        const brand = await Brand.findByPk(req.user.brand_id);
        
        // Load payment method data if payment_method_id is set
        let paymentMethodData = null;
        if (payment.payment_method_id) {
          const paymentMethod = await PaymentMethod.findByPk(payment.payment_method_id);
          if (paymentMethod) {
            paymentMethodData = {
              type: paymentMethod.type,
              account_name: paymentMethod.account_name,
              account_number_or_email: paymentMethod.account_number_or_email
            };
          }
        }
        
        await sendPaymentNotification(
          recipients,
          artist.name,
          {
            amount: parseFloat(amount),
            description: description || '',
            payment_processing_fee: finalProcessingFee,
            paid_thru_type: paid_thru_type || 'Not specified',
            paid_thru_account_name: paid_thru_account_name || '',
            paid_thru_account_number: paid_thru_account_number || '',
            paymentMethod: paymentMethodData
          },
          {
            name: brand?.brand_name || brand?.name,
            brand_color: brand?.brand_color,
            logo_url: brand?.logo_url,
            id: brand?.id || req.user.brand_id
          }
        );
      }
    }

    res.status(201).json({
      message: 'Payment added successfully',
      payment
    });
  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPayments = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id } = req.query;
    const artistIdNum = artist_id ? parseInt(artist_id as string, 10) : undefined;

    const where: any = {};
    if (artist_id) {
      where.artist_id = artistIdNum;
    }

    const payments = await Payment.findAll({
      where,
      include: [
        { 
          model: Artist, 
          as: 'artist',
          where: { brand_id: req.user.brand_id }
        }
      ],
      order: [['date_paid', 'DESC']]
    });

    res.json({ payments });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get payment by ID
export const getPaymentById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findOne({
      where: { id },
      include: [
        { 
          model: Artist, 
          as: 'artist',
          where: { brand_id: req.user.brand_id }
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ payment });
  } catch (error) {
    console.error('Get payment by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get payments by artist ID  
export const getPaymentsByArtist = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id } = req.params;
    const { page = '1', limit = '10', sortBy, sortDirection, ...filters } = req.query;

    // Verify artist belongs to user's brand
    const artist = await Artist.findOne({
      where: { 
        id: artist_id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const pageNum = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const offset = (pageNum - 1) * pageSize;

    // Build where conditions based on filters
    const where: any = { artist_id: artist_id };
    
    // Add search filters
    if (filters.description && filters.description !== '') {
      where.description = { [require('sequelize').Op.like]: `%${filters.description}%` };
    }
    
    if (filters.paid_thru_type && filters.paid_thru_type !== '') {
      where.paid_thru_type = { [require('sequelize').Op.like]: `%${filters.paid_thru_type}%` };
    }
    
    if (filters.amount && filters.amount !== '') {
      where.amount = parseFloat(filters.amount as string);
    }
    
    if (filters.payment_processing_fee && filters.payment_processing_fee !== '') {
      where.payment_processing_fee = parseFloat(filters.payment_processing_fee as string);
    }
    
    if (filters.date_paid && filters.date_paid !== '') {
      // Search by date (exact match for the day)
      const searchDate = new Date(filters.date_paid as string);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      where.date_paid = {
        [require('sequelize').Op.gte]: searchDate,
        [require('sequelize').Op.lt]: nextDay
      };
    }

    // Build order clause
    let orderClause: any[] = [['date_paid', 'DESC']]; // Default order
    
    if (sortBy && sortDirection) {
      const validSortColumns = ['date_paid', 'description', 'paid_thru_type', 'amount', 'payment_processing_fee'];
      const validDirections = ['asc', 'desc'];
      
      if (validSortColumns.includes(sortBy as string) && validDirections.includes((sortDirection as string).toLowerCase())) {
        orderClause = [[sortBy as string, (sortDirection as string).toUpperCase()]];
      }
    }

    // Get payments for this artist with pagination and filters
    const { count, rows: payments } = await Payment.findAndCountAll({
      where,
      include: [
        { 
          model: Artist, 
          as: 'artist',
          where: { brand_id: req.user.brand_id }
        },
        {
          model: PaymentMethod,
          as: 'paymentMethod',
          required: false // Left join - include payments without payment methods
        }
      ],
      order: orderClause,
      limit: pageSize,
      offset: offset
    });

    const totalPages = Math.ceil(count / pageSize);

    res.json({ 
      payments,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: count,
        per_page: pageSize,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      },
      artist: {
        id: artist.id,
        name: artist.name
      }
    });
  } catch (error) {
    console.error('Get payments by artist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Note: Payment methods management moved to artistController.ts

// EXPENSES MANAGEMENT - moved to release information section

export const getFinancialSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id } = req.query;
    const artistIdNum = artist_id ? parseInt(artist_id as string, 10) : undefined;

    let summary: any = {};

    if (artist_id) {
      // Artist-specific summary
      const artist = await Artist.findOne({
        where: { 
          id: artistIdNum,
          brand_id: req.user.brand_id 
        }
      });

      if (!artist) {
        return res.status(404).json({ error: 'Artist not found' });
      }

      const totalRoyalties = await Royalty.sum('amount', {
        where: { artist_id: artistIdNum }
      }) || 0;

      const totalPayments = await Payment.sum('amount', {
        where: { artist_id: artistIdNum }
      }) || 0;

      // Calculate total earnings for this artist by first finding releases, then summing earnings
      const artistReleases = await ReleaseArtist.findAll({
        where: { artist_id: artistIdNum },
        attributes: ['release_id'],
        include: [{
          model: Release,
          as: 'release',
          where: { brand_id: req.user.brand_id },
          attributes: ['id']
        }]
      });

      const releaseIds = artistReleases.map(ra => ra.release_id);
      
      const totalEarnings = releaseIds.length > 0 ? await Earning.sum('amount', {
        where: {
          release_id: releaseIds
        }
      }) || 0 : 0;

      summary = {
        artist_id,
        artist_name: artist.name,
        total_earnings: totalEarnings,
        total_royalties: totalRoyalties,
        total_payments: totalPayments,
        current_balance: totalRoyalties - totalPayments,
        payout_point: artist.payout_point
      };
    } else {
      // Brand-wide summary
      const earningsResult = await Earning.findAll({
        include: [{
          model: Release,
          as: 'release',
          where: { brand_id: req.user.brand_id }
        }],
        attributes: [
          [require('sequelize').fn('sum', require('sequelize').col('amount')), 'total']
        ],
        raw: true
      });
      const totalEarnings = (earningsResult[0] as any)?.total || 0;

      const royaltiesResult = await Royalty.findAll({
        include: [{
          model: Artist,
          as: 'artist',
          where: { brand_id: req.user.brand_id }
        }],
        attributes: [
          [require('sequelize').fn('sum', require('sequelize').col('amount')), 'total']
        ],
        raw: true
      });
      const totalRoyalties = (royaltiesResult[0] as any)?.total || 0;

      const paymentsResult = await Payment.findAll({
        include: [{
          model: Artist,
          as: 'artist',
          where: { brand_id: req.user.brand_id }
        }],
        attributes: [
          [require('sequelize').fn('sum', require('sequelize').col('amount')), 'total']
        ],
        raw: true
      });
      const totalPayments = (paymentsResult[0] as any)?.total || 0;

      summary = {
        brand_id: req.user.brand_id,
        total_earnings: totalEarnings,
        total_royalties: totalRoyalties,
        total_payments: totalPayments,
        label_profit: totalEarnings - totalRoyalties
      };
    }

    res.json({ summary });
  } catch (error) {
    console.error('Get financial summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// WALLET BALANCE
export const getWalletBalance = async (req: AuthRequest, res: Response) => {
  try {
    // Get brand information
    const brand = await Brand.findOne({
      where: { id: req.user.brand_id }
    });

    if (!brand || !brand.paymongo_wallet_id) {
      return res.status(400).json({ error: 'Brand wallet not configured' });
    }

    const paymentService = new PaymentService();
    const balance = await paymentService.getWalletBalance(brand.paymongo_wallet_id);

    if (balance === -1) {
      return res.status(500).json({ error: 'Failed to fetch wallet balance' });
    }

    res.json({ balance });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Note: Payout settings management moved to artistController.ts

// Note: Release information management moved to artistController.ts

// ADMIN SUMMARY ENDPOINTS (based on PHP admin-summary-view.php)
export const getAdminEarningsSummary = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Get all releases for the brand
    const releases = await Release.findAll({
      where: { brand_id: req.user.brand_id }
    });

    const releaseIds = releases.map(r => r.id);

    if (releaseIds.length === 0) {
      return res.json({
        physical_earnings: 0,
        download_earnings: 0,
        streaming_earnings: 0,
        sync_earnings: 0
      });
    }

    // Get earnings by type for the date range
    const earningsByType = await Earning.findAll({
      where: {
        release_id: releaseIds,
        date_recorded: {
          [require('sequelize').Op.between]: [start_date, end_date]
        }
      },
      attributes: [
        'type',
        [require('sequelize').fn('sum', require('sequelize').col('amount')), 'total']
      ],
      group: ['type'],
      raw: true
    });

    // Initialize summary with zeros
    const summary = {
      physical_earnings: 0,
      download_earnings: 0,
      streaming_earnings: 0,
      sync_earnings: 0
    };

    // Populate summary with actual earnings
    earningsByType.forEach((earning: any) => {
      const total = parseFloat(earning.total) || 0;
      switch (earning.type) {
        case 'Physical':
          summary.physical_earnings = total;
          break;
        case 'Downloads':
          summary.download_earnings = total;
          break;
        case 'Streaming':
          summary.streaming_earnings = total;
          break;
        case 'Sync':
          summary.sync_earnings = total;
          break;
      }
    });

    res.json(summary);
  } catch (error) {
    console.error('Get admin earnings summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAdminPaymentsRoyaltiesSummary = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Get all artists for the brand
    const artists = await Artist.findAll({
      where: { brand_id: req.user.brand_id }
    });

    const artistSummaries = [];
    let overallTotalPayments = 0;
    let overallTotalRoyalties = 0;

    for (const artist of artists) {
      // Get total payments for this artist in the date range
      const totalPayments = await Payment.sum('amount', {
        where: {
          artist_id: artist.id,
          date_paid: {
            [require('sequelize').Op.between]: [start_date, end_date]
          }
        }
      }) || 0;

      // Get total royalties for this artist in the date range
      const totalRoyalties = await Royalty.sum('amount', {
        where: {
          artist_id: artist.id,
          date_recorded: {
            [require('sequelize').Op.between]: [start_date, end_date]
          }
        }
      }) || 0;

      // Only include artists with payments or royalties
      if (totalPayments > 0 || totalRoyalties > 0) {
        artistSummaries.push({
          artist_id: artist.id,
          artist_name: artist.name,
          total_payments: totalPayments,
          total_royalties: totalRoyalties
        });

        overallTotalPayments += totalPayments;
        overallTotalRoyalties += totalRoyalties;
      }
    }

    // Get recuperable expenses
    const totalNewRecuperableExpense = await RecuperableExpense.sum('expense_amount', {
      where: {
        brand_id: req.user.brand_id,
        expense_amount: {
          [require('sequelize').Op.gt]: 0
        },
        date_recorded: {
          [require('sequelize').Op.between]: [start_date, end_date]
        }
      }
    }) || 0;

    const totalRecuperatedExpense = await RecuperableExpense.sum('expense_amount', {
      where: {
        brand_id: req.user.brand_id,
        expense_amount: {
          [require('sequelize').Op.lt]: 0  
        },
        date_recorded: {
          [require('sequelize').Op.between]: [start_date, end_date]
        }
      }
    }) || 0;

    res.json({
      artist_summaries: artistSummaries,
      overall_total_payments: overallTotalPayments,
      overall_total_royalties: overallTotalRoyalties,
      total_new_recuperable_expense: totalNewRecuperableExpense,
      total_recuperated_expense: Math.abs(totalRecuperatedExpense)
    });
  } catch (error) {
    console.error('Get admin payments royalties summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to send earning notifications (matching PHP logic)
async function sendEarningNotifications(earning: any, brandId: number, recuperationInfo: any = null) {
  try {
    // Get release with associated artists and brand
    const release = await Release.findByPk(earning.release_id, {
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
          model: Brand,
          as: 'brand'
        }
      ]
    });

    if (!release || !release.releaseArtists || release.releaseArtists.length === 0) {
      return;
    }

    // Process each artist (matching PHP logic)
    for (const releaseArtist of release.releaseArtists) {
      if (!releaseArtist.artist) {
        continue;
      }

      // Get artist access (team members with email addresses)
      const artistAccess = await ArtistAccess.findAll({
        where: { artist_id: releaseArtist.artist.id },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['email_address', 'first_name', 'last_name']
          }
        ]
      });

      if (!artistAccess || artistAccess.length === 0) {
        continue;
      }

      // Get email addresses for team members
      const emailAddresses = artistAccess
        .map((access: any) => access.user?.email_address)
        .filter((email: string) => email); // Remove any undefined emails

      if (emailAddresses.length === 0) {
        continue;
      }

      // Use recuperable expense information from royalty processing
      const recuperatedAmount = recuperationInfo?.recuperatedAmount || 0;
      const recuperableBalance = recuperationInfo?.remainingRecuperableBalance || 0;
      
      // Get royalty amount for this artist if it exists
      const royalty = await Royalty.findOne({
        where: { 
          earning_id: earning.id,
          artist_id: releaseArtist.artist.id
        }
      });
      const royaltyAmount = royalty ? royalty.amount : null;

      // Get brand settings
      const brandName = release.brand?.brand_name || 'Label Dashboard';
      const brandColor = release.brand?.brand_color || '#667eea';
      const brandLogo = release.brand?.logo_url || '';
      
      // Generate dashboard URL
      const protocol = process.env.USE_HTTPS === 'true' ? 'https' : 'http';
      const host = process.env.FRONTEND_HOST || 'localhost:4200';
      const dashboardUrl = `${protocol}://${host}/financial#earnings`;

      // Send earnings notification email
      await sendEarningsNotification(
        emailAddresses,
        releaseArtist.artist.name,
        release.title || 'Unknown Release',
        earning.description || `${earning.type} earnings`,
        earning.amount.toString(),
        recuperatedAmount.toString(),
        recuperableBalance.toString(),
        royaltyAmount ? royaltyAmount.toString() : null,
        brandName,
        brandColor,
        brandLogo,
        dashboardUrl,
        release.brand_id
      );
    }

  } catch (error) {
    console.error('Error sending earning notifications:', error);
    // Don't throw error - email failures shouldn't block earning creation
  }
}

// ADMIN BALANCE SUMMARY - with pagination, search, and sorting
export const getAdminBalanceSummary = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { page = '1', limit = '10', sortBy, sortDirection, ...filters } = req.query;

    const pageNum = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const offset = (pageNum - 1) * pageSize;

    // Build where clause for artist filtering
    const artistWhere: any = { brand_id: req.user.brand_id };
    
    // Add column-specific filters
    if (filters.name && filters.name !== '') {
      artistWhere.name = { [require('sequelize').Op.like]: `%${filters.name}%` };
    }
    
    if (filters.payout_point && filters.payout_point !== '') {
      artistWhere.payout_point = parseFloat(filters.payout_point as string);
    }

    // Get ALL artists for the brand with filters (no pagination yet)
    const artists = await Artist.findAll({
      where: artistWhere
    });

    // Calculate balance data for each artist
    const artistBalances = await Promise.all(
      artists.map(async (artist) => {
        // Get total royalties for artist
        const totalRoyalties = parseFloat((await Royalty.sum('amount', {
          where: { artist_id: artist.id }
        }) || 0).toFixed(2));

        // Get total payments for artist
        const totalPayments = parseFloat((await Payment.sum('amount', {
          where: { artist_id: artist.id }
        }) || 0).toFixed(2));

        const totalBalance = parseFloat((totalRoyalties - totalPayments).toFixed(2));
        const dueForPayment = totalBalance > artist.payout_point;

        // Check if artist has payment methods
        const paymentMethods = await PaymentMethod.findAll({
          where: { artist_id: artist.id }
        });
        const hasPaymentMethod = paymentMethods.length > 0;

        return {
          id: artist.id,
          name: artist.name,
          total_royalties: totalRoyalties,
          total_payments: totalPayments,
          total_balance: totalBalance,
          payout_point: parseFloat((artist.payout_point || 0).toString()),
          due_for_payment: dueForPayment,
          hold_payouts: artist.hold_payouts || false,
          has_payment_method: hasPaymentMethod,
          ready_for_payment: dueForPayment && hasPaymentMethod && !artist.hold_payouts
        };
      })
    );

    // Apply post-calculation filters on computed values
    let filteredBalances = artistBalances.filter(artist => {
      // Filter by total_royalties
      if (filters.total_royalties && filters.total_royalties !== '') {
        const filterValue = parseFloat(filters.total_royalties as string);
        if (isNaN(filterValue) || artist.total_royalties !== filterValue) {
          return false;
        }
      }
      
      // Filter by total_payments
      if (filters.total_payments && filters.total_payments !== '') {
        const filterValue = parseFloat(filters.total_payments as string);
        if (isNaN(filterValue) || artist.total_payments !== filterValue) {
          return false;
        }
      }
      
      // Filter by total_balance
      if (filters.total_balance && filters.total_balance !== '') {
        const filterValue = parseFloat(filters.total_balance as string);
        if (isNaN(filterValue) || artist.total_balance !== filterValue) {
          return false;
        }
      }
      
      // Filter by due_for_payment
      if (filters.due_for_payment && filters.due_for_payment !== '') {
        const filterValue = filters.due_for_payment === 'true';
        if (artist.due_for_payment !== filterValue) {
          return false;
        }
      }
      
      // Filter by hold_payouts
      if (filters.hold_payouts && filters.hold_payouts !== '') {
        const filterValue = filters.hold_payouts === 'true';
        if (artist.hold_payouts !== filterValue) {
          return false;
        }
      }
      
      return true;
    });

    // Apply sorting to the results
    if (sortBy && sortDirection) {
      const validSortColumns = ['name', 'total_royalties', 'total_payments', 'total_balance', 'payout_point'];
      const validDirections = ['asc', 'desc'];
      
      if (validSortColumns.includes(sortBy as string) && validDirections.includes((sortDirection as string).toLowerCase())) {
        filteredBalances.sort((a, b) => {
          let aValue = a[sortBy as keyof typeof a];
          let bValue = b[sortBy as keyof typeof b];
          
          // Handle string vs number comparison
          if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = (bValue as string).toLowerCase();
          }
          
          if (sortDirection === 'desc') {
            return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
          } else {
            return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
          }
        });
      }
    }

    // Calculate summary statistics from filtered results
    const totalBalance = parseFloat(filteredBalances.reduce((sum, artist) => sum + artist.total_balance, 0).toFixed(2));
    const totalDueForPayment = parseFloat(filteredBalances
      .filter(artist => artist.due_for_payment)
      .reduce((sum, artist) => sum + artist.total_balance, 0).toFixed(2));
    const readyForPayment = parseFloat(filteredBalances
      .filter(artist => artist.ready_for_payment)
      .reduce((sum, artist) => sum + artist.total_balance, 0).toFixed(2));
    const pausedPayouts = parseFloat(filteredBalances
      .filter(artist => artist.due_for_payment && artist.hold_payouts)
      .reduce((sum, artist) => sum + artist.total_balance, 0).toFixed(2));

    // Apply pagination to filtered results
    const totalFilteredCount = filteredBalances.length;
    const paginatedBalances = filteredBalances.slice(offset, offset + pageSize);
    const totalPages = Math.ceil(totalFilteredCount / pageSize);

    res.json({
      data: paginatedBalances,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: totalFilteredCount,
        per_page: pageSize,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      },
      summary: {
        total_balance: totalBalance,
        total_due_for_payment: totalDueForPayment,
        ready_for_payment: readyForPayment,
        paused_payouts: pausedPayouts
      }
    });
  } catch (error) {
    console.error('Get admin balance summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ADMIN RECUPERABLE EXPENSES SUMMARY
export const getAdminRecuperableExpenses = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { page = '1', limit = '10', sortBy, sortDirection, ...filters } = req.query;

    const pageNum = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const offset = (pageNum - 1) * pageSize;

    // Build where clause for release filtering
    const releaseWhere: any = { brand_id: req.user.brand_id };
    
    // Add column-specific filters
    if (filters.catalog_no && filters.catalog_no !== '') {
      releaseWhere.catalog_no = { [require('sequelize').Op.like]: `%${filters.catalog_no}%` };
    }
    
    if (filters.title && filters.title !== '') {
      releaseWhere.title = { [require('sequelize').Op.like]: `%${filters.title}%` };
    }

    // Get all releases for the brand
    const releases = await Release.findAll({
      where: releaseWhere
    });

    const releaseExpenses = [];
    let totalRecuperableExpense = 0;

    for (const release of releases) {
      // Calculate recuperable expense balance for this release
      const expenses = await RecuperableExpense.findAll({
        where: { release_id: release.id }
      });

      const recuperableBalance = expenses.reduce((sum, expense) => sum + parseFloat((expense.expense_amount || 0).toString()), 0);

      if (recuperableBalance > 0) {
        const expenseItem = {
          release_id: release.id,
          catalog_no: release.catalog_no,
          title: release.title,
          remaining_expense: parseFloat(recuperableBalance.toFixed(2))
        };
        
        // Apply remaining_expense filter
        if (filters.remaining_expense && filters.remaining_expense !== '') {
          const filterValue = parseFloat(filters.remaining_expense as string);
          if (!isNaN(filterValue) && recuperableBalance === filterValue) {
            releaseExpenses.push(expenseItem);
            totalRecuperableExpense += parseFloat(recuperableBalance.toFixed(2));
          }
        } else {
          releaseExpenses.push(expenseItem);
          totalRecuperableExpense += parseFloat(recuperableBalance.toFixed(2));
        }
      }
    }

    // Apply sorting
    if (sortBy && sortDirection) {
      const validSortColumns = ['catalog_no', 'title', 'remaining_expense'];
      const validDirections = ['asc', 'desc'];
      
      if (validSortColumns.includes(sortBy as string) && validDirections.includes((sortDirection as string).toLowerCase())) {
        releaseExpenses.sort((a, b) => {
          let aValue = a[sortBy as keyof typeof a];
          let bValue = b[sortBy as keyof typeof b];
          
          if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = (bValue as string).toLowerCase();
          }
          
          if (sortDirection === 'desc') {
            return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
          } else {
            return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
          }
        });
      }
    }

    // Apply pagination
    const totalRecords = releaseExpenses.length;
    const paginatedExpenses = releaseExpenses.slice(offset, offset + pageSize);
    const totalPages = Math.ceil(totalRecords / pageSize);

    res.json({
      data: paginatedExpenses,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: totalRecords,
        per_page: pageSize,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      },
      summary: {
        total_recuperable_expense: parseFloat(totalRecuperableExpense.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Get admin recuperable expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// HELPER: Check if artist is ready for payment and return payment details
interface ArtistPaymentDetails {
  artist: any;
  balance: number;
  isReadyForPayment: boolean;
}

const getArtistPaymentDetails = async (artist: any): Promise<ArtistPaymentDetails> => {
  // Calculate balance
  const totalRoyalties = parseFloat((await Royalty.sum('amount', {
    where: { artist_id: artist.id }
  }) || 0).toFixed(2));

  const totalPayments = parseFloat((await Payment.sum('amount', {
    where: { artist_id: artist.id }
  }) || 0).toFixed(2));

  const balance = parseFloat((totalRoyalties - totalPayments).toFixed(2));

  // Check if ready for payment
  let isReadyForPayment = false;
  if (balance > artist.payout_point) {
    // Check if has payment methods
    const paymentMethods = await PaymentMethod.findAll({
      where: { artist_id: artist.id }
    });
    isReadyForPayment = paymentMethods.length > 0;
  }

  return {
    artist,
    balance,
    isReadyForPayment
  };
};

// GET ARTISTS READY FOR PAYMENT WITH DETAILS
export const getArtistsReadyForPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get all artists for this brand that don't have payouts on hold
    const artists = await Artist.findAll({
      where: { 
        brand_id: req.user.brand_id,
        hold_payouts: false
      }
    });

    const readyForPayment = [];
    let totalAmount = 0;

    for (const artist of artists) {
      const paymentDetails = await getArtistPaymentDetails(artist);
      
      if (paymentDetails.isReadyForPayment) {
        readyForPayment.push({
          id: artist.id,
          name: artist.name,
          total_balance: paymentDetails.balance
        });

        totalAmount += paymentDetails.balance;
      }
    }

    res.json({
      artists: readyForPayment,
      total_amount: parseFloat(totalAmount.toFixed(2))
    });
  } catch (error) {
    console.error('Get artists ready for payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// HELPER: Process individual payment with Paymongo and email notification
const processArtistPayment = async (artist: any, balance: number, brandId: number) => {
  // Get payment methods for the artist
  const paymentMethods = await PaymentMethod.findAll({
    where: { artist_id: artist.id }
  });

  if (paymentMethods.length === 0) {
    throw new Error(`No payment methods found for artist ${artist.name}`);
  }

  // Use the first available payment method
  const paymentMethod = paymentMethods[0];
  
  let finalAmount = balance;
  let finalProcessingFee = 0;
  let finalReferenceNumber = null;

  // Handle Paymongo payment processing
  try {
    const paymentService = new PaymentService();
    
    // Get brand info for wallet configuration
    const brand = await Brand.findByPk(brandId);
    if (!brand || !brand.paymongo_wallet_id) {
      throw new Error('Brand wallet not configured for payments');
    }

    // Calculate processing fee
    const processingFee = brand.payment_processing_fee_for_payouts || 0;
    const transferAmount = balance - processingFee;

    // Send money through Paymongo
    const referenceNumber = await paymentService.sendMoneyTransfer(
      brand.id,
      paymentMethod.id,
      transferAmount,
      'Batch payment - All balances'
    );

    if (!referenceNumber) {
      throw new Error('Payment processing failed');
    }

    finalProcessingFee = processingFee;
    finalReferenceNumber = referenceNumber;
  } catch (error) {
    console.error('Paymongo payment error for artist', artist.name, ':', error);
    throw error;
  }

  // Create payment record
  const payment = await Payment.create({
    artist_id: artist.id,
    amount: finalAmount,
    description: 'Batch payment - All balances',
    date_paid: new Date(),
    payment_method_id: paymentMethod.id,
    reference_number: finalReferenceNumber,
    payment_processing_fee: finalProcessingFee
  });

  // Send payment notification email
  try {
    // Get artist team members
    const { ArtistAccess, User, Brand } = require('../models');
    const artistAccess = await ArtistAccess.findAll({
      where: { artist_id: artist.id },
      include: [{ model: User, as: 'user' }]
    });

    const recipients = artistAccess.map(access => access.user.email_address);

    if (recipients.length > 0) {
      // Get brand info for proper email formatting
      const brand = await Brand.findByPk(brandId);
      
      await sendPaymentNotification(
        recipients,
        artist.name,
        {
          amount: balance,
          description: 'Batch payment - All balances',
          payment_processing_fee: finalProcessingFee,
          // Don't set legacy paid_thru_* fields for batch payments
          paymentMethod: {
            type: paymentMethod.type,
            account_name: paymentMethod.account_name,
            account_number_or_email: paymentMethod.account_number_or_email
          }
        },
        {
          name: brand?.brand_name || brand?.name,
          brand_color: brand?.brand_color,
          logo_url: brand?.logo_url,
          id: brand?.id || brandId
        }
      );
    }
  } catch (emailError) {
    console.error('Email notification error for artist', artist.name, ':', emailError);
    // Don't fail the payment if email fails
  }

  return {
    artist_id: artist.id,
    artist_name: artist.name,
    amount: balance,
    payment_id: payment.id,
    reference_number: finalReferenceNumber
  };
};

// PAY ALL BALANCES
export const payAllBalances = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get all artists for this brand that don't have payouts on hold
    const artists = await Artist.findAll({
      where: { 
        brand_id: req.user.brand_id,
        hold_payouts: false
      }
    });

    const payments = [];
    const failedPayments = [];
    let totalPaid = 0;

    for (const artist of artists) {
      const paymentDetails = await getArtistPaymentDetails(artist);
      
      if (paymentDetails.isReadyForPayment) {
        try {
          const paymentResult = await processArtistPayment(
            artist, 
            paymentDetails.balance, 
            req.user.brand_id
          );
          
          payments.push(paymentResult);
          totalPaid += paymentDetails.balance;
        } catch (error) {
          console.error(`Failed to process payment for artist ${artist.name}:`, error);
          failedPayments.push({
            artist_id: artist.id,
            artist_name: artist.name,
            amount: paymentDetails.balance,
            error: error.message
          });
        }
      }
    }

    const response: any = {
      message: `Successfully paid ${payments.length} artists`,
      total_amount: parseFloat(totalPaid.toFixed(2)),
      payments: payments
    };

    if (failedPayments.length > 0) {
      response.failed_payments = failedPayments;
      response.message += `, ${failedPayments.length} payments failed`;
    }

    res.json(response);
  } catch (error) {
    console.error('Pay all balances error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// CSV EXPORT FUNCTIONS
export const downloadEarningsCSV = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id } = req.query;
    let artistIdNum = artist_id ? parseInt(artist_id as string, 10) : undefined;
    
    if (!artistIdNum || isNaN(artistIdNum)) {
      return res.status(400).json({ error: 'Valid artist ID is required' });
    }

    // Verify artist access
    if (!req.user.is_admin) {
      const artistAccess = await ArtistAccess.findOne({
        where: {
          artist_id: artistIdNum,
          user_id: req.user.id
        }
      });
      if (!artistAccess) {
        return res.status(403).json({ error: 'Access denied to this artist' });
      }
    }

    const { sortBy, sortDirection, start_date, end_date, ...filters } = req.query;

    // Build where conditions
    const where: any = {};
    const releaseWhere: any = {};
    
    // Add date range filter
    if (start_date && end_date) {
      where.date_recorded = {
        [require('sequelize').Op.between]: [start_date, end_date]
      };
    }

    // Add text filters - separate filters for earnings table vs release table
    Object.keys(filters).forEach(key => {
      if (filters[key] && typeof filters[key] === 'string' && filters[key].trim() !== '') {
        if (key === 'release_title') {
          // This filter belongs to the release table
          releaseWhere.title = {
            [require('sequelize').Op.like]: `%${filters[key]}%`
          };
        } else if (key === 'artist_id') {
          // artist_id is already handled by the ReleaseArtist join condition
          // Don't add to where clause as earning table doesn't have artist_id column
        } else {
          // These filters belong to the earnings table
          where[key] = {
            [require('sequelize').Op.like]: `%${filters[key]}%`
          };
        }
      }
    });

    // Build order array for sorting
    let order: any[] = [['date_recorded', 'DESC']];
    if (sortBy && sortDirection) {
      order = [[sortBy as string, sortDirection === 'desc' ? 'DESC' : 'ASC']];
    }

    // Get earnings data
    const earnings = await Earning.findAll({
      include: [
        {
          model: Release,
          as: 'release',
          required: true, // INNER JOIN to ensure only earnings with releases
          where: Object.keys(releaseWhere).length > 0 ? releaseWhere : undefined,
          include: [
            {
              model: ReleaseArtist,
              as: 'releaseArtists',
              required: true, // INNER JOIN to ensure only releases for this artist
              where: { artist_id: artistIdNum },
              attributes: []
            }
          ],
          attributes: ['title']
        }
      ],
      where,
      order,
      raw: false
    });

    // Convert to CSV format
    const csvHeaders = ['Date', 'Release', 'Description', 'Amount'];
    const csvRows = earnings.map(earning => [
      new Date(earning.date_recorded).toLocaleDateString(),
      earning.release?.title || '',
      earning.description || '',
      `${parseFloat(earning.amount.toString()).toFixed(2)}`
    ]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="earnings.csv"');
    
    res.send(csvContent);
  } catch (error) {
    console.error('Download earnings CSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const downloadRoyaltiesCSV = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id } = req.query;
    let artistIdNum = artist_id ? parseInt(artist_id as string, 10) : undefined;
    
    if (!artistIdNum || isNaN(artistIdNum)) {
      return res.status(400).json({ error: 'Valid artist ID is required' });
    }

    // Verify artist access
    if (!req.user.is_admin) {
      const artistAccess = await ArtistAccess.findOne({
        where: {
          artist_id: artistIdNum,
          user_id: req.user.id
        }
      });
      if (!artistAccess) {
        return res.status(403).json({ error: 'Access denied to this artist' });
      }
    }

    const { sortBy, sortDirection, start_date, end_date, ...filters } = req.query;

    // Build where conditions - separate filters for royalty table vs release table
    const where: any = {};
    const releaseWhere: any = {};
    
    // Add date range filter
    if (start_date && end_date) {
      where.date_recorded = {
        [require('sequelize').Op.between]: [start_date, end_date]
      };
    }

    // Add text filters - separate filters for royalty table vs release table
    Object.keys(filters).forEach(key => {
      if (filters[key] && typeof filters[key] === 'string' && filters[key].trim() !== '') {
        if (key === 'release_title') {
          // This filter belongs to the release table
          releaseWhere.title = {
            [require('sequelize').Op.like]: `%${filters[key]}%`
          };
        } else if (key === 'artist_id') {
          // artist_id is already handled by the ReleaseArtist join condition
          // Don't add to where clause as royalty table doesn't have artist_id column
        } else {
          // These filters belong to the royalty table
          where[key] = {
            [require('sequelize').Op.like]: `%${filters[key]}%`
          };
        }
      }
    });

    // Build order array for sorting
    let order: any[] = [['date_recorded', 'DESC']];
    if (sortBy && sortDirection) {
      order = [[sortBy as string, sortDirection === 'desc' ? 'DESC' : 'ASC']];
    }

    // Get royalties data
    const royalties = await Royalty.findAll({
      include: [
        {
          model: Release,
          as: 'release',
          required: true, // INNER JOIN to ensure only royalties with releases
          where: Object.keys(releaseWhere).length > 0 ? releaseWhere : undefined,
          include: [
            {
              model: ReleaseArtist,
              as: 'releaseArtists',
              required: true, // INNER JOIN to ensure only releases for this artist
              where: { artist_id: artistIdNum },
              attributes: []
            }
          ],
          attributes: ['title']
        }
      ],
      where,
      order,
      raw: false
    });

    // Convert to CSV format
    const csvHeaders = ['Date', 'Release', 'Description', 'Amount'];
    const csvRows = royalties.map(royalty => [
      new Date(royalty.date_recorded).toLocaleDateString(),
      royalty.release?.title || '',
      royalty.description || '',
      `${parseFloat(royalty.amount.toString()).toFixed(2)}`
    ]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="royalties.csv"');
    
    res.send(csvContent);
  } catch (error) {
    console.error('Download royalties CSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};