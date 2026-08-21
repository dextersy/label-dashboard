'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ticket', 'member_discount_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      after: 'platform_fee',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('ticket', 'member_discount_amount');
  },
};
