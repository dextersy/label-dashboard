'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Update existing tickets with "Payment Confirmed" or "Ticket sent." status  
    // Set date_paid to order_timestamp (or current timestamp if order_timestamp is null)
    await queryInterface.sequelize.query(`
      UPDATE ticket 
      SET date_paid = COALESCE(order_timestamp, NOW())
      WHERE status IN ('Payment Confirmed', 'Ticket sent.')
        AND date_paid IS NULL
    `);
  },

  async down (queryInterface, Sequelize) {
    // Set date_paid back to NULL for all tickets
    await queryInterface.sequelize.query(`
      UPDATE ticket 
      SET date_paid = NULL
      WHERE status IN ('Payment Confirmed', 'Ticket sent.')
    `);
  }
};
