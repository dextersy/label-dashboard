'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Fix invalid '0000-00-00' dates in release table
    await queryInterface.sequelize.query(`
      SET sql_mode = 'ALLOW_INVALID_DATES';
      UPDATE release SET release_date = NULL WHERE release_date = '0000-00-00';
    `);

    // Update percentage columns to allow values up to 1.000 (100%)
    await queryInterface.changeColumn('release_artist', 'streaming_royalty_percentage', {
      type: Sequelize.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0.500
    });

    await queryInterface.changeColumn('release_artist', 'sync_royalty_percentage', {
      type: Sequelize.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0.500
    });

    await queryInterface.changeColumn('release_artist', 'download_royalty_percentage', {
      type: Sequelize.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0.500
    });

    await queryInterface.changeColumn('release_artist', 'physical_royalty_percentage', {
      type: Sequelize.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0.200
    });

    // Allow NULL values in ticket.order_timestamp column
    await queryInterface.changeColumn('ticket', 'order_timestamp', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Fix orphaned earning_id values in royalty table
    await queryInterface.sequelize.query(`
      UPDATE royalty 
      SET earning_id = NULL 
      WHERE earning_id NOT IN (SELECT id FROM earning);
    `);

    // Change email_attempt.body to LONGTEXT to handle larger content
    await queryInterface.changeColumn('email_attempt', 'body', {
      type: Sequelize.TEXT('long'),
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert percentage columns back to DECIMAL(3,3)
    await queryInterface.changeColumn('release_artist', 'streaming_royalty_percentage', {
      type: Sequelize.DECIMAL(3, 3),
      allowNull: false,
      defaultValue: 0.500
    });

    await queryInterface.changeColumn('release_artist', 'sync_royalty_percentage', {
      type: Sequelize.DECIMAL(3, 3),
      allowNull: false,
      defaultValue: 0.500
    });

    await queryInterface.changeColumn('release_artist', 'download_royalty_percentage', {
      type: Sequelize.DECIMAL(3, 3),
      allowNull: false,
      defaultValue: 0.500
    });

    await queryInterface.changeColumn('release_artist', 'physical_royalty_percentage', {
      type: Sequelize.DECIMAL(3, 3),
      allowNull: false,
      defaultValue: 0.200
    });

    // Note: Cannot revert the date and timestamp fixes as they would cause data loss
    console.log('Note: Date and timestamp fixes cannot be reverted to avoid data corruption');
  }
};