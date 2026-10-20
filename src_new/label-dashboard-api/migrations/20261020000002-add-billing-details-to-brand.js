'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('brand', 'billing_company_name', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('brand', 'billing_address', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('brand', 'billing_tin', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('brand', 'billing_company_name');
    await queryInterface.removeColumn('brand', 'billing_address');
    await queryInterface.removeColumn('brand', 'billing_tin');
  },
};
