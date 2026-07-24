'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('press_campaign', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'brand',
          key: 'id'
        },
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      writeup: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      release_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'release',
          key: 'id'
        },
        onUpdate: 'NO ACTION',
        onDelete: 'SET NULL'
      },
      artist_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'artist',
          key: 'id'
        },
        onUpdate: 'NO ACTION',
        onDelete: 'SET NULL'
      },
      cover_art: {
        type: Sequelize.STRING(512),
        allowNull: true
      },
      mp3_file: {
        type: Sequelize.STRING(512),
        allowNull: true
      },
      public_slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      status: {
        type: Sequelize.ENUM('Draft', 'Published'),
        allowNull: false,
        defaultValue: 'Draft'
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id'
        },
        onUpdate: 'NO ACTION',
        onDelete: 'NO ACTION'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB'
    });

    await queryInterface.addIndex('press_campaign', ['brand_id'], {
      name: 'idx_press_campaign_brand_id'
    });
    await queryInterface.addIndex('press_campaign', ['artist_id'], {
      name: 'idx_press_campaign_artist_id'
    });
    await queryInterface.addIndex('press_campaign', ['release_id'], {
      name: 'idx_press_campaign_release_id'
    });
    await queryInterface.addIndex('press_campaign', ['public_slug'], {
      name: 'idx_press_campaign_public_slug',
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('press_campaign');
  }
};
