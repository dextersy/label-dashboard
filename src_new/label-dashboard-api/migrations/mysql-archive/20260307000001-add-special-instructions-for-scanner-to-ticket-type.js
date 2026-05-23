'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ticket_type', 'special_instructions_for_scanner', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: 'Optional instructions shown to the scanner operator when checking in a ticket of this type'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('ticket_type', 'special_instructions_for_scanner');
  }
};
