'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('brand', 'paymongo_secret_key');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('brand', 'paymongo_secret_key', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },
};
