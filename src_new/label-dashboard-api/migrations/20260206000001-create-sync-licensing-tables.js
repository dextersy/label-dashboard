'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create sync_licensing_pitch table
    await queryInterface.createTable('sync_licensing_pitch', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'brand',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
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
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB'
    });

    // Add indexes for sync_licensing_pitch
    await queryInterface.addIndex('sync_licensing_pitch', ['brand_id'], {
      name: 'idx_sync_licensing_pitch_brand'
    });
    await queryInterface.addIndex('sync_licensing_pitch', ['created_by'], {
      name: 'idx_sync_licensing_pitch_created_by'
    });

    // Create sync_licensing_pitch_song junction table
    await queryInterface.createTable('sync_licensing_pitch_song', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      pitch_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'sync_licensing_pitch',
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
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB'
    });

    // Add indexes for sync_licensing_pitch_song
    await queryInterface.addIndex('sync_licensing_pitch_song', ['pitch_id', 'song_id'], {
      name: 'idx_sync_licensing_pitch_song_unique',
      unique: true
    });
    await queryInterface.addIndex('sync_licensing_pitch_song', ['pitch_id'], {
      name: 'idx_sync_licensing_pitch_song_pitch'
    });
    await queryInterface.addIndex('sync_licensing_pitch_song', ['song_id'], {
      name: 'idx_sync_licensing_pitch_song_song'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sync_licensing_pitch_song');
    await queryInterface.dropTable('sync_licensing_pitch');
  }
};
