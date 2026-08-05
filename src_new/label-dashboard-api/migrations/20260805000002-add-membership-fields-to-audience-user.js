'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('audience_user', 'membership_id', {
      type: Sequelize.STRING(12),
      allowNull: true,
      unique: true,
    });
    await queryInterface.addColumn('audience_user', 'membership_tier', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'silver',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('audience_user', 'membership_tier');
    await queryInterface.removeColumn('audience_user', 'membership_id');
  },
};
