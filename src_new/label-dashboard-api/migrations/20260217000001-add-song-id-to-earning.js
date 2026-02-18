'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add nullable song_id column to earning table
    await queryInterface.addColumn('earning', 'song_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: {
        model: 'song',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add index on song_id for query performance
    await queryInterface.addIndex('earning', ['song_id'], {
      name: 'idx_earning_song_id'
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop the foreign key and index first
    const [constraints] = await queryInterface.sequelize.query(`
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_NAME = 'earning'
        AND COLUMN_NAME = 'song_id'
        AND REFERENCED_TABLE_NAME = 'song'
        AND TABLE_SCHEMA = DATABASE()
    `);

    for (const row of constraints) {
      await queryInterface.sequelize.query(
        `ALTER TABLE earning DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``
      );
    }

    await queryInterface.removeIndex('earning', 'idx_earning_song_id');
    await queryInterface.removeColumn('earning', 'song_id');
  }
};
