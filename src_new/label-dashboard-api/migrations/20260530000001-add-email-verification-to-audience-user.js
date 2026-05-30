'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('audience_user', 'email_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'reset_hash_expires_at',
    });
    await queryInterface.addColumn('audience_user', 'email_verification_token', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'email_verified',
    });
    await queryInterface.addColumn('audience_user', 'email_verification_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'email_verification_token',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('audience_user', 'email_verification_expires_at');
    await queryInterface.removeColumn('audience_user', 'email_verification_token');
    await queryInterface.removeColumn('audience_user', 'email_verified');
  },
};
