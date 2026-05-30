'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('audience_user', 'reset_hash_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'reset_hash',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('audience_user', 'reset_hash_expires_at');
  },
};
