'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_press_campaign_status" ADD VALUE IF NOT EXISTS 'Sent';
    `);
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL does not support removing values from an ENUM type.
    // To revert, you would need to recreate the type and update the column.
  },
};
