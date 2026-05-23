'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add the 'Refunded' status to the existing ENUM for ticket status
    await queryInterface.changeColumn('ticket', 'status', {
      type: Sequelize.ENUM('New', 'Payment Confirmed', 'Ticket sent.', 'Canceled', 'Refunded'),
      allowNull: false,
      defaultValue: 'New'
    });
  },

  async down(queryInterface, Sequelize) {
    // Update any 'Refunded' tickets to 'Canceled' before removing the enum value
    await queryInterface.sequelize.query(
      "UPDATE `ticket` SET `status` = 'Canceled' WHERE `status` = 'Refunded';"
    );

    // Revert the enum to the original state without 'Refunded'
    await queryInterface.changeColumn('ticket', 'status', {
      type: Sequelize.ENUM('New', 'Payment Confirmed', 'Ticket sent.', 'Canceled'),
      allowNull: false,
      defaultValue: 'New'
    });
  }
};
