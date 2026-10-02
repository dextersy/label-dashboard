'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('brand', 'loyverse_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('brand', 'loyverse_api_key', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('brand', 'woocommerce_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('brand', 'woocommerce_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn('brand', 'woocommerce_consumer_key', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('brand', 'woocommerce_consumer_secret', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('brand', 'loyverse_enabled');
    await queryInterface.removeColumn('brand', 'loyverse_api_key');
    await queryInterface.removeColumn('brand', 'woocommerce_enabled');
    await queryInterface.removeColumn('brand', 'woocommerce_url');
    await queryInterface.removeColumn('brand', 'woocommerce_consumer_key');
    await queryInterface.removeColumn('brand', 'woocommerce_consumer_secret');
  },
};
