'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('wristband_order', 'billing_same_as_shipping', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn('wristband_order', 'billing_name', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
    await queryInterface.addColumn('wristband_order', 'billing_street', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('wristband_order', 'billing_city', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('wristband_order', 'billing_country', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('wristband_order', 'billing_zip', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('wristband_order', 'billing_zip');
    await queryInterface.removeColumn('wristband_order', 'billing_country');
    await queryInterface.removeColumn('wristband_order', 'billing_city');
    await queryInterface.removeColumn('wristband_order', 'billing_street');
    await queryInterface.removeColumn('wristband_order', 'billing_name');
    await queryInterface.removeColumn('wristband_order', 'billing_same_as_shipping');
  },
};
