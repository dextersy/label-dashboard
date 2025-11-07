'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ticket', 'platform_fee', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      comment: 'Platform fee calculated based on brand fee settings'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('ticket', 'platform_fee');
  }
};