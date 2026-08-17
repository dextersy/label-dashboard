'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('brand_plan', 'status', {
      type: Sequelize.ENUM('active', 'incomplete', 'past_due', 'unpaid', 'cancelled'),
      allowNull: false,
      defaultValue: 'active',
    });
    await queryInterface.addColumn('brand_plan', 'paymongo_customer_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('brand_plan', 'paymongo_subscription_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('brand_plan', 'paymongo_subscription_id');
    await queryInterface.removeColumn('brand_plan', 'paymongo_customer_id');
    await queryInterface.removeColumn('brand_plan', 'status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_brand_plan_status";');
  },
};
