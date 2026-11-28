'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('plan', 'default_merch_transaction_fixed_fee', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('plan', 'default_merch_revenue_percentage_fee', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('plan', 'default_merch_fee_revenue_type', {
      type: Sequelize.ENUM('net', 'gross'),
      allowNull: true,
      defaultValue: 'net',
    });
    await queryInterface.addColumn('plan', 'feature_merch_workspace', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('plan', 'feature_merch_workspace');
    await queryInterface.removeColumn('plan', 'default_merch_fee_revenue_type');
    await queryInterface.removeColumn('plan', 'default_merch_revenue_percentage_fee');
    await queryInterface.removeColumn('plan', 'default_merch_transaction_fixed_fee');
  },
};
