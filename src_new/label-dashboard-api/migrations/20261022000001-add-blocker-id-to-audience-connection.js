'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('audience_connection', 'blocker_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: { model: 'audience_user', key: 'id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('audience_connection', 'blocker_id');
  },
};
