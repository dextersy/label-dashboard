'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('payment', 'failure_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('label_payment', 'failure_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('payment', 'failure_reason');
    await queryInterface.removeColumn('label_payment', 'failure_reason');
  }
};
