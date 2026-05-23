'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * This is an example migration file.
     * No actual database changes are made here.
     * Use this as a template for future migrations when needed.
     */
    
    // Example: Add column with existence check
    /*
    const tableInfo = await queryInterface.describeTable('table_name');
    if (!tableInfo.column_name) {
      await queryInterface.addColumn('table_name', 'column_name', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Description of the column'
      });
    }
    */
    
    console.log('Example migration - no changes applied');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Revert the changes made in the up method.
     * This example migration has no changes to revert.
     */
    
    // Example: Remove column with existence check
    /*
    const tableInfo = await queryInterface.describeTable('table_name');
    if (tableInfo.column_name) {
      await queryInterface.removeColumn('table_name', 'column_name');
    }
    */
    
    console.log('Example migration rollback - no changes reverted');
  }
};