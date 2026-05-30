'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ticket', 'audience_user_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'audience_user',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ticket', 'audience_user_id');
  },
};
