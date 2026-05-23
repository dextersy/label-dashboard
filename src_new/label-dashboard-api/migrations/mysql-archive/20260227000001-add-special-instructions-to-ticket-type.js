'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ticket_type', 'special_instructions', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: 'Optional special instructions shown to buyers who select this ticket type'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('ticket_type', 'special_instructions');
  }
};
