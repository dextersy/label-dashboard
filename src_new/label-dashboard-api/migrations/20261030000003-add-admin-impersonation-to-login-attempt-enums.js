'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_login_attempt_auth_method ADD VALUE IF NOT EXISTS 'admin_impersonation';
    `);
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL does not support removing enum values without recreating the type.
    // Left as a no-op since removing enum values is rarely needed in practice.
  }
};
