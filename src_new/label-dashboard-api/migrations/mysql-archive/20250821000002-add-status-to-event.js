'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('event');
    
    if (!tableInfo.status) {
      // Add the column with 'draft' as default first
      await queryInterface.addColumn('event', 'status', {
        type: Sequelize.ENUM('draft', 'published'),
        allowNull: false,
        defaultValue: 'draft',
        comment: 'Event status - draft events are not visible to public'
      });

      // Update all existing records to 'published' so they remain visible
      await queryInterface.sequelize.query(
        "UPDATE event SET status = 'published' WHERE status = 'draft'"
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('event');
    
    if (tableInfo.status) {
      await queryInterface.removeColumn('event', 'status');
    }
  }
};