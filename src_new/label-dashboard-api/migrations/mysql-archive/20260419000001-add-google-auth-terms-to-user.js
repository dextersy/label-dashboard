'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user', 'google_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'onboarding_completed',
    });
    await queryInterface.addColumn('user', 'terms_accepted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'google_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('user', 'google_id');
    await queryInterface.removeColumn('user', 'terms_accepted_at');
  },
};
