'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    
    // Example: Add column with existence check
    const tableInfo = await queryInterface.describeTable('table_name');
    if (!tableInfo.column_name) {
      await queryInterface.addColumn('table_name', 'column_name', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
        comment: 'Description of the column'
      });
    }

    // Example: Create table
    /*
    await queryInterface.createTable('new_table', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });
    */

    // Example: Add index
    /*
    await queryInterface.addIndex('table_name', {
      fields: ['column_name'],
      name: 'idx_table_column'
    });
    */

    // Example: Add foreign key
    /*
    await queryInterface.addConstraint('table_name', {
      fields: ['foreign_key_column'],
      type: 'foreign key',
      name: 'fk_table_reference',
      references: {
        table: 'reference_table',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    */
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    
    // Example: Remove column with existence check
    const tableInfo = await queryInterface.describeTable('table_name');
    if (tableInfo.column_name) {
      await queryInterface.removeColumn('table_name', 'column_name');
    }

    // Example: Drop table
    /*
    await queryInterface.dropTable('new_table');
    */

    // Example: Remove index
    /*
    await queryInterface.removeIndex('table_name', 'idx_table_column');
    */

    // Example: Remove foreign key
    /*
    await queryInterface.removeConstraint('table_name', 'fk_table_reference');
    */
  }
};