'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('audience_user', 'signed_up_from', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
      after: 'age_confirmed_at',
    });
    await queryInterface.addColumn('audience_user', 'signup_reference', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
      after: 'signed_up_from',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('audience_user', 'signup_reference');
    await queryInterface.removeColumn('audience_user', 'signed_up_from');
  },
};
