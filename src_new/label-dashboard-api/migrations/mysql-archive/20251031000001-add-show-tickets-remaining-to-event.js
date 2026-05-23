'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if show_tickets_remaining column already exists
    const tableInfo = await queryInterface.describeTable('event');
    if (!tableInfo.show_tickets_remaining) {
      await queryInterface.addColumn('event', 'show_tickets_remaining', {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: 'Whether to display remaining tickets count on public ticket buy page'
      });

      // Set default value to true (1) for all existing events
      await queryInterface.sequelize.query(
        'UPDATE event SET show_tickets_remaining = 1 WHERE show_tickets_remaining IS NULL'
      );
    }
  },

  async down(queryInterface, Sequelize) {
    // Check if show_tickets_remaining column exists before removing
    const tableInfo = await queryInterface.describeTable('event');
    if (tableInfo.show_tickets_remaining) {
      await queryInterface.removeColumn('event', 'show_tickets_remaining');
    }
  }
};
