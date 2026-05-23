'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('event', 'walk_in_max_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      after: 'walk_in_supports_card'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('event', 'walk_in_max_count');
  }
};
