'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('brand_plan', 'pre_checkout_status', {
      type: Sequelize.ENUM('active', 'incomplete', 'past_due', 'unpaid', 'cancelled'),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('brand_plan', 'pre_checkout_status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_brand_plan_pre_checkout_status";');
  },
};
