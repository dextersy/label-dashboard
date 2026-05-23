'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create release_song join table
    await queryInterface.createTable('release_song', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      release_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'release',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      song_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'song',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      track_number: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // 2. Add unique constraint to prevent duplicate song-release links
    await queryInterface.addIndex('release_song', ['release_id', 'song_id'], {
      unique: true,
      name: 'unique_release_song'
    });

    // 3. Migrate existing data from song table into release_song
    await queryInterface.sequelize.query(`
      INSERT INTO release_song (release_id, song_id, track_number, createdAt, updatedAt)
      SELECT release_id, id, track_number, NOW(), NOW()
      FROM song
      WHERE release_id IS NOT NULL
    `);

    // 4. Drop the foreign key constraint on song.release_id
    // MySQL requires knowing the constraint name; query it dynamically
    const [constraints] = await queryInterface.sequelize.query(`
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_NAME = 'song'
        AND COLUMN_NAME = 'release_id'
        AND REFERENCED_TABLE_NAME = 'release'
        AND TABLE_SCHEMA = DATABASE()
    `);

    for (const row of constraints) {
      await queryInterface.sequelize.query(
        `ALTER TABLE song DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``
      );
    }

    // 5. Remove release_id and track_number columns from song table
    await queryInterface.removeColumn('song', 'release_id');
    await queryInterface.removeColumn('song', 'track_number');
  },

  async down(queryInterface, Sequelize) {
    // 1. Re-add release_id and track_number columns to song table
    await queryInterface.addColumn('song', 'release_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'release',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await queryInterface.addColumn('song', 'track_number', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // 2. Migrate data back: for each song, use the first release_song entry
    await queryInterface.sequelize.query(`
      UPDATE song s
      INNER JOIN (
        SELECT song_id, release_id, track_number
        FROM release_song
        WHERE id IN (
          SELECT MIN(id) FROM release_song GROUP BY song_id
        )
      ) rs ON s.id = rs.song_id
      SET s.release_id = rs.release_id, s.track_number = rs.track_number
    `);

    // 3. Drop the release_song table
    await queryInterface.dropTable('release_song');
  }
};
