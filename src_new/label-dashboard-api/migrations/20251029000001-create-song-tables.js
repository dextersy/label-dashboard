'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create song table
    await queryInterface.createTable('song', {
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
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      track_number: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Duration in seconds'
      },
      lyrics: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      audio_file: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Path to audio file'
      },
      isrc: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'International Standard Recording Code'
      },
      spotify_link: {
        type: Sequelize.STRING(1024),
        allowNull: true,
      },
      apple_music_link: {
        type: Sequelize.STRING(1024),
        allowNull: true,
      },
      youtube_link: {
        type: Sequelize.STRING(1024),
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

    // Create song_collaborator table (many-to-many with artist)
    await queryInterface.createTable('song_collaborator', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
      artist_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'artist',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      role: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Role in the song (e.g., Featured Artist, Vocalist, etc.)'
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

    // Add unique constraint to prevent duplicate collaborators
    await queryInterface.addIndex('song_collaborator', ['song_id', 'artist_id'], {
      unique: true,
      name: 'unique_song_artist_collaborator'
    });

    // Create song_author table
    await queryInterface.createTable('song_author', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      pro_affiliation: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Performance Rights Organization (e.g., ASCAP, BMI, SESAC)'
      },
      ipi_number: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Interested Party Information number'
      },
      share_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Percentage share of authorship (0-100)'
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

    // Create song_composer table
    await queryInterface.createTable('song_composer', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      pro_affiliation: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Performance Rights Organization (e.g., ASCAP, BMI, SESAC)'
      },
      ipi_number: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Interested Party Information number'
      },
      share_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Percentage share of composition (0-100)'
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
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order due to foreign key constraints
    await queryInterface.dropTable('song_composer');
    await queryInterface.dropTable('song_author');
    await queryInterface.dropTable('song_collaborator');
    await queryInterface.dropTable('song');
  }
};
