'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex('brand_plan', ['paymongo_subscription_id'], {
      name: 'idx_brand_plan_paymongo_subscription_id',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('brand_plan', 'idx_brand_plan_paymongo_subscription_id');
  },
};
