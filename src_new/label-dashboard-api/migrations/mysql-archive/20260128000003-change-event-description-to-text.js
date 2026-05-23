'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Change event description from VARCHAR(1024) to TEXT to accommodate HTML content
    await queryInterface.changeColumn('event', 'description', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert back to VARCHAR(1024)
    await queryInterface.changeColumn('event', 'description', {
      type: Sequelize.STRING(1024),
      allowNull: true
    });
  }
};
