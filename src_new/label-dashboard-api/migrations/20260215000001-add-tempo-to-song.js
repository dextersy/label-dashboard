'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Starting migration: add-tempo-to-song');

    const tableInfo = await queryInterface.describeTable('song');

    if (!tableInfo.tempo) {
      await queryInterface.addColumn('song', 'tempo', {
        type: Sequelize.FLOAT,
        allowNull: true,
        after: 'duration',
        comment: 'BPM (beats per minute) detected from audio file'
      });
      console.log('✓ Added tempo column to song table');
    } else {
      console.log('⚠ tempo column already exists, skipping');
    }

    console.log('Migration completed: add-tempo-to-song');
  },

  async down(queryInterface, Sequelize) {
    console.log('Rolling back migration: add-tempo-to-song');

    const tableInfo = await queryInterface.describeTable('song');

    if (tableInfo.tempo) {
      await queryInterface.removeColumn('song', 'tempo');
      console.log('✓ Removed tempo column');
    }

    console.log('Migration rollback completed: add-tempo-to-song');
  }
};
