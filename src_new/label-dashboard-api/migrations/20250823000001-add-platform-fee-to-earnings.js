'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('earning');
    
    // Add platform_fee column to earnings table
    if (!tableInfo.platform_fee) {
      await queryInterface.addColumn('earning', 'platform_fee', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Platform fee calculated based on brand fee settings for this earning'
      });

      // Calculate platform fees for existing earnings that have royalties
      await calculatePlatformFeesForExistingEarnings(queryInterface, Sequelize);
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('earning');
    
    // Remove platform_fee column if it exists
    if (tableInfo.platform_fee) {
      await queryInterface.removeColumn('earning', 'platform_fee');
    }
  }
};

/**
 * Calculate platform fees for existing earnings that have royalties
 */
async function calculatePlatformFeesForExistingEarnings(queryInterface, Sequelize) {
  console.log('🔄 Calculating platform fees for existing earnings...');
  
  try {
    // Get all earnings that have associated royalties (indicating they've been processed)
    const [earningsWithRoyalties] = await queryInterface.sequelize.query(`
      SELECT DISTINCT e.id, e.release_id, e.amount, r.brand_id
      FROM earning e
      INNER JOIN royalty roy ON e.id = roy.earning_id
      INNER JOIN \`release\` r ON e.release_id = r.id
      WHERE e.amount IS NOT NULL AND e.amount > 0
      ORDER BY e.id
    `);

    if (earningsWithRoyalties.length === 0) {
      console.log('ℹ️ No existing earnings with royalties found to process.');
      return;
    }

    console.log(`📊 Found ${earningsWithRoyalties.length} earnings with royalties to process.`);

    let totalProcessedCount = 0;
    let platformFeeAddedCount = 0;
    let errorCount = 0;

    for (const earning of earningsWithRoyalties) {
      try {
        const platformFee = await calculatePlatformFeeForEarning(
          queryInterface,
          earning.brand_id,
          parseFloat(earning.amount),
          earning.release_id,
          earning.id
        );

        // Update the earning with the calculated platform fee
        await queryInterface.sequelize.query(`
          UPDATE earning 
          SET platform_fee = :platformFee 
          WHERE id = :earningId
        `, {
          replacements: {
            platformFee: platformFee,
            earningId: earning.id
          }
        });

        totalProcessedCount++;
        
        // Only count earnings that had actual platform fees added (non-zero)
        if (platformFee > 0) {
          platformFeeAddedCount++;
        }
        
        // Log progress every 100 records
        if (totalProcessedCount % 100 === 0) {
          console.log(`⏳ Processed ${totalProcessedCount}/${earningsWithRoyalties.length} earnings (${platformFeeAddedCount} with platform fees)...`);
        }
        
      } catch (error) {
        console.error(`❌ Error calculating platform fee for earning ${earning.id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`✅ Platform fee calculation completed!`);
    console.log(`📈 Total earnings processed: ${totalProcessedCount}`);
    console.log(`💰 Earnings with platform fees added: ${platformFeeAddedCount}`);
    if (errorCount > 0) {
      console.log(`⚠️ Errors encountered: ${errorCount} earnings`);
    }

  } catch (error) {
    console.error('❌ Error during platform fee calculation for existing earnings:', error);
    throw error;
  }
}

/**
 * Calculate platform fee for a specific earning (migration version)
 */
async function calculatePlatformFeeForEarning(queryInterface, brandId, earningAmount, releaseId, earningId) {
  // Get brand fee settings
  const [brandResults] = await queryInterface.sequelize.query(`
    SELECT music_transaction_fixed_fee, music_revenue_percentage_fee, music_fee_revenue_type
    FROM brand 
    WHERE id = :brandId
  `, {
    replacements: { brandId }
  });

  if (brandResults.length === 0) {
    return 0; // No brand found, no fee
  }

  const brand = brandResults[0];
  let fixedFee = 0;
  let percentageFee = 0;

  // 1. Fixed fee per transaction
  if (brand.music_transaction_fixed_fee && parseFloat(brand.music_transaction_fixed_fee) > 0) {
    fixedFee = parseFloat(brand.music_transaction_fixed_fee);
  }

  // 2. Percentage fee calculation
  if (brand.music_revenue_percentage_fee && parseFloat(brand.music_revenue_percentage_fee) > 0) {
    if (brand.music_fee_revenue_type === 'gross') {
      // Apply percentage to gross earning amount
      percentageFee = (earningAmount * parseFloat(brand.music_revenue_percentage_fee)) / 100;
    } else if (brand.music_fee_revenue_type === 'net') {
      // Apply percentage to net revenue (after recuperable expenses and royalties)
      const netRevenue = await calculateNetRevenueForEarning(
        queryInterface,
        earningAmount,
        releaseId,
        earningId
      );
      percentageFee = (netRevenue * parseFloat(brand.music_revenue_percentage_fee)) / 100;
    }
  }

  const totalPlatformFee = parseFloat((fixedFee + percentageFee).toFixed(2));
  return totalPlatformFee;
}

/**
 * Calculate net revenue for an earning (migration version)
 */
async function calculateNetRevenueForEarning(queryInterface, earningAmount, releaseId, earningId) {
  let netRevenue = earningAmount;

  // Deduct recuperable expenses
  const [expenseResults] = await queryInterface.sequelize.query(`
    SELECT COALESCE(SUM(expense_amount), 0) as total_expenses
    FROM recuperable_expense 
    WHERE release_id = :releaseId
  `, {
    replacements: { releaseId }
  });

  const recuperableBalance = parseFloat(expenseResults[0]?.total_expenses || 0);

  // If there are recuperable expenses, they reduce the net revenue
  if (recuperableBalance > 0) {
    if (earningAmount >= recuperableBalance) {
      // Earning covers all remaining recuperable expenses
      netRevenue = earningAmount - recuperableBalance;
    } else {
      // Earning partially covers recuperable expenses, no net revenue left
      netRevenue = 0;
    }
  }

  // Deduct royalties
  if (netRevenue > 0) {
    const [royaltyResults] = await queryInterface.sequelize.query(`
      SELECT COALESCE(SUM(amount), 0) as total_royalties
      FROM royalty 
      WHERE earning_id = :earningId
    `, {
      replacements: { earningId }
    });

    const totalRoyalties = parseFloat(royaltyResults[0]?.total_royalties || 0);
    netRevenue = Math.max(0, netRevenue - totalRoyalties);
  }

  return Math.max(0, netRevenue);
}