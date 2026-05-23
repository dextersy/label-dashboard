'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('event', 'walk_in_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'status'
    });
    await queryInterface.addColumn('event', 'walk_in_supports_cash', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'walk_in_enabled'
    });
    await queryInterface.addColumn('event', 'walk_in_supports_gcash', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'walk_in_supports_cash'
    });
    await queryInterface.addColumn('event', 'walk_in_supports_card', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'walk_in_supports_gcash'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('event', 'walk_in_supports_card');
    await queryInterface.removeColumn('event', 'walk_in_supports_gcash');
    await queryInterface.removeColumn('event', 'walk_in_supports_cash');
    await queryInterface.removeColumn('event', 'walk_in_enabled');
  }
};
