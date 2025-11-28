'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add disabled field to ticket_type table
    await queryInterface.addColumn('ticket_type', 'disabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this ticket type is disabled/hidden from the buy page'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the disabled column
    await queryInterface.removeColumn('ticket_type', 'disabled');
  }
};
