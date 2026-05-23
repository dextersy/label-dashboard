'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add payment_id column to ticket table
    await queryInterface.addColumn('ticket', 'payment_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'checkout_key'
    });

    // Add index for faster lookups
    await queryInterface.addIndex('ticket', ['payment_id'], {
      name: 'idx_ticket_payment_id'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index
    await queryInterface.removeIndex('ticket', 'idx_ticket_payment_id');

    // Remove payment_id column
    await queryInterface.removeColumn('ticket', 'payment_id');
  }
};
