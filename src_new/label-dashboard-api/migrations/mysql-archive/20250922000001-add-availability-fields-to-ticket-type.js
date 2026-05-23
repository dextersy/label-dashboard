'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add max_tickets field - 0 means unlimited
    await queryInterface.addColumn('ticket_type', 'max_tickets', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '0 = unlimited tickets, any positive number = maximum tickets available'
    });

    // Add start_date field for availability window
    await queryInterface.addColumn('ticket_type', 'start_date', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When this ticket type becomes available for purchase (null = available immediately)'
    });

    // Add end_date field for availability window
    await queryInterface.addColumn('ticket_type', 'end_date', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When this ticket type stops being available for purchase (null = available until event)'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the added columns
    await queryInterface.removeColumn('ticket_type', 'max_tickets');
    await queryInterface.removeColumn('ticket_type', 'start_date');
    await queryInterface.removeColumn('ticket_type', 'end_date');
  }
};