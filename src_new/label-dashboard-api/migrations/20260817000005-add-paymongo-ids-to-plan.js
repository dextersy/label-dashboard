'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('plan', 'paymongo_plan_id_monthly', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('plan', 'paymongo_plan_id_annual', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('plan', 'paymongo_plan_id_monthly');
    await queryInterface.removeColumn('plan', 'paymongo_plan_id_annual');
  },
};
