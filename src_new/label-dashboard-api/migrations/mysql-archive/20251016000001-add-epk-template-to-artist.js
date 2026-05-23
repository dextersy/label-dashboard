'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if epk_template column already exists
    const tableInfo = await queryInterface.describeTable('artist');
    if (!tableInfo.epk_template) {
      await queryInterface.addColumn('artist', 'epk_template', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'EPK template selection (1 = Modern Gradient, 2 = Minimal Clean)'
      });

      console.log('Added epk_template column to artist table');
    } else {
      console.log('epk_template column already exists in artist table');
    }
  },

  async down(queryInterface, Sequelize) {
    // Check if epk_template column exists before removing
    const tableInfo = await queryInterface.describeTable('artist');
    if (tableInfo.epk_template) {
      await queryInterface.removeColumn('artist', 'epk_template');
      console.log('Removed epk_template column from artist table');
    }
  }
};
