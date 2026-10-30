'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('login_attempt', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Re-adding NOT NULL will fail if any null rows exist — clean those up first if reverting.
    await queryInterface.changeColumn('login_attempt', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  }
};
