'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if countdown_display column already exists
    const tableInfo = await queryInterface.describeTable('event');
    if (!tableInfo.countdown_display) {
      await queryInterface.addColumn('event', 'countdown_display', {
        type: Sequelize.ENUM('always', '1_week', '3_days', '1_day', 'never'),
        allowNull: false,
        defaultValue: '1_week',
        comment: 'When to display countdown: always, 1_week, 3_days, 1_day, never'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Check if countdown_display column exists before removing
    const tableInfo = await queryInterface.describeTable('event');
    if (tableInfo.countdown_display) {
      await queryInterface.removeColumn('event', 'countdown_display');
    }
  }
};