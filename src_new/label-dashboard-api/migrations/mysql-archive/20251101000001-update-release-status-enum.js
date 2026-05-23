'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Change the status column to support new values
    // First, we need to modify the column to a temporary VARCHAR
    await queryInterface.changeColumn('release', 'status', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'Draft'
    });

    // Update existing statuses to new naming if needed
    // 'Pending' remains as is for backwards compatibility

    // Now change it back to ENUM with the new values
    await queryInterface.changeColumn('release', 'status', {
      type: Sequelize.ENUM('Draft', 'For Submission', 'Pending', 'Live', 'Taken Down'),
      allowNull: false,
      defaultValue: 'Draft'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert to original ENUM values
    await queryInterface.changeColumn('release', 'status', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'Pending'
    });

    await queryInterface.changeColumn('release', 'status', {
      type: Sequelize.ENUM('Pending', 'Live', 'Taken Down'),
      allowNull: false,
      defaultValue: 'Pending'
    });
  }
};
