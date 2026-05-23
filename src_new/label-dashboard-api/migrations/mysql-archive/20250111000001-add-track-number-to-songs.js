'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add track_number column to song table
     * This column stores the track position in a release
     */

    const tableInfo = await queryInterface.describeTable('song');
    if (!tableInfo.track_number) {
      await queryInterface.addColumn('song', 'track_number', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Track position in the release'
      });
      console.log('Added track_number column to song table');
    } else {
      console.log('track_number column already exists in song table');
    }
  },

  async down(queryInterface, Sequelize) {
    /**
     * Revert by removing the track_number column
     */

    const tableInfo = await queryInterface.describeTable('song');
    if (tableInfo.track_number) {
      await queryInterface.removeColumn('song', 'track_number');
      console.log('Removed track_number column from song table');
    } else {
      console.log('track_number column does not exist in song table');
    }
  }
};
