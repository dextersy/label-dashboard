'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('audience_user', 'terms_accepted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('audience_user', 'privacy_accepted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('audience_user', 'age_confirmed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('audience_user', 'age_confirmed_at');
    await queryInterface.removeColumn('audience_user', 'privacy_accepted_at');
    await queryInterface.removeColumn('audience_user', 'terms_accepted_at');
  },
};
