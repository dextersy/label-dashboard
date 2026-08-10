'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('login_attempt', 'auth_method', {
      type: Sequelize.ENUM('password', 'google'),
      allowNull: true, // nullable so existing rows are unaffected
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('login_attempt', 'auth_method');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_login_attempt_auth_method";');
  }
};
