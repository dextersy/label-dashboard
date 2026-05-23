'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if profile_photo_id column already exists
    const tableInfo = await queryInterface.describeTable('artist');
    if (!tableInfo.profile_photo_id) {
      await queryInterface.addColumn('artist', 'profile_photo_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'artist_image',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Foreign key to artist_image table for profile photo'
      });
      
      // Add index for better query performance
      await queryInterface.addIndex('artist', ['profile_photo_id'], {
        name: 'idx_artist_profile_photo_id'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Check if profile_photo_id column exists before removing
    const tableInfo = await queryInterface.describeTable('artist');
    if (tableInfo.profile_photo_id) {
      // Remove index first
      await queryInterface.removeIndex('artist', 'idx_artist_profile_photo_id');
      // Remove column
      await queryInterface.removeColumn('artist', 'profile_photo_id');
    }
  }
};