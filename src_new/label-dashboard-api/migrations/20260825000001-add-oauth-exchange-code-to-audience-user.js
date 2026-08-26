'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('audience_user', 'oauth_exchange_code', {
      type: Sequelize.STRING(64),
      allowNull: true,
      unique: true,
    });
    await queryInterface.addColumn('audience_user', 'oauth_exchange_code_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('audience_user', 'oauth_exchange_code_expires_at');
    await queryInterface.removeColumn('audience_user', 'oauth_exchange_code');
  },
};
