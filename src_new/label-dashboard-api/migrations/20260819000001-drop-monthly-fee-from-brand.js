'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('brand');
    if (tableDescription.monthly_fee) {
      await queryInterface.removeColumn('brand', 'monthly_fee');
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('brand');
    if (!tableDescription.monthly_fee) {
      await queryInterface.addColumn('brand', 'monthly_fee', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      });
    }
  },
};
