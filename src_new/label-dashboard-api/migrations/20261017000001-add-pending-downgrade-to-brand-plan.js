'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('brand_plan', 'pending_plan_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'plan',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('brand_plan', 'pending_billing_cycle', {
      type: Sequelize.ENUM('monthly', 'annual'),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('brand_plan', 'pending_billing_cycle');
    await queryInterface.removeColumn('brand_plan', 'pending_plan_id');
  },
};
