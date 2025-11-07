'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('ticket', 'date_paid', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Date when the ticket payment was confirmed'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('ticket', 'date_paid');
  }
};
