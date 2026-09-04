'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('audience_user', 'membership_tier');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('audience_user', 'membership_tier', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'silver',
    });
  },
};
