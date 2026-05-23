'use strict';

/**
 * Migration: Add exclude_from_epk column to artist_image and release tables
 *
 * This migration supports the EPK content management feature:
 * - Adds exclude_from_epk column (TINYINT(1)) to artist_image table
 * - Adds exclude_from_epk column (TINYINT(1)) to release table
 * - Defaults to 0 (false) - items are included in EPK by default
 * - No indexes added (tables at or near 64 index limit)
 *
 * Feature benefits:
 * - Allows selective hiding of photos/releases from public EPK pages
 * - Content remains visible in admin dashboard
 * - Per-item control over public visibility
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add exclude_from_epk to artist_image table
    const artistImageTableInfo = await queryInterface.describeTable('artist_image');
    
    if (!artistImageTableInfo.exclude_from_epk) {
      console.log('Adding exclude_from_epk column to artist_image table...');
      
      await queryInterface.addColumn('artist_image', 'exclude_from_epk', {
        type: Sequelize.TINYINT(1),
        allowNull: false,
        defaultValue: 0,
        comment: 'Hide this photo from public EPK page (0 = show, 1 = hide)'
      });

      console.log('✅ Added exclude_from_epk column to artist_image');
    } else {
      console.log('⚠️  exclude_from_epk column already exists in artist_image table, skipping...');
    }

    // Add exclude_from_epk to release table
    const releaseTableInfo = await queryInterface.describeTable('release');
    
    if (!releaseTableInfo.exclude_from_epk) {
      console.log('Adding exclude_from_epk column to release table...');
      
      await queryInterface.addColumn('release', 'exclude_from_epk', {
        type: Sequelize.TINYINT(1),
        allowNull: false,
        defaultValue: 0,
        comment: 'Hide this release from public EPK page (0 = show, 1 = hide)'
      });

      // Note: Not adding index due to MySQL's 64 index limit on release table
      // Filtering performance should still be acceptable due to small result sets

      console.log('✅ Added exclude_from_epk column to release (no index - table at 64 index limit)');
    } else {
      console.log('⚠️  exclude_from_epk column already exists in release table, skipping...');
    }

    console.log('');
    console.log('🎨 EPK Content Management Feature Ready:');
    console.log('   - Gallery photos can be excluded from EPK');
    console.log('   - Releases can be excluded from EPK');
    console.log('   - Toggle via admin dashboard');
    console.log('   - Content remains visible in admin view');
  },

  async down(queryInterface, Sequelize) {
    // Remove column from artist_image
    const artistImageTableInfo = await queryInterface.describeTable('artist_image');
    
    if (artistImageTableInfo.exclude_from_epk) {
      console.log('Removing exclude_from_epk from artist_image table...');
      
      await queryInterface.removeColumn('artist_image', 'exclude_from_epk');
      
      console.log('✅ Removed exclude_from_epk from artist_image');
    }

    // Remove column from release
    const releaseTableInfo = await queryInterface.describeTable('release');
    
    if (releaseTableInfo.exclude_from_epk) {
      console.log('Removing exclude_from_epk from release table...');
      
      await queryInterface.removeColumn('release', 'exclude_from_epk');
      
      console.log('✅ Removed exclude_from_epk from release');
    }
  }
};
