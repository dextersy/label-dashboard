'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add missing columns to song table to match the updated Song model
     * Production has old schema - adding new columns for songs feature
     */

    const tableInfo = await queryInterface.describeTable('song');

    // Add duration column (for song length in seconds)
    if (!tableInfo.duration) {
      await queryInterface.addColumn('song', 'duration', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Song duration in seconds'
      });
      console.log('Added duration column to song table');
    }

    // Add audio_file column (new column for audio master files)
    // Note: Production has master_url, but the new model uses audio_file
    if (!tableInfo.audio_file) {
      await queryInterface.addColumn('song', 'audio_file', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'S3 path to audio master file'
      });
      console.log('Added audio_file column to song table');
    }

    // Add spotify_link column
    if (!tableInfo.spotify_link) {
      await queryInterface.addColumn('song', 'spotify_link', {
        type: Sequelize.STRING(1024),
        allowNull: true,
        comment: 'Link to song on Spotify'
      });
      console.log('Added spotify_link column to song table');
    }

    // Add apple_music_link column
    if (!tableInfo.apple_music_link) {
      await queryInterface.addColumn('song', 'apple_music_link', {
        type: Sequelize.STRING(1024),
        allowNull: true,
        comment: 'Link to song on Apple Music'
      });
      console.log('Added apple_music_link column to song table');
    }

    // Add youtube_link column
    if (!tableInfo.youtube_link) {
      await queryInterface.addColumn('song', 'youtube_link', {
        type: Sequelize.STRING(1024),
        allowNull: true,
        comment: 'Link to song on YouTube'
      });
      console.log('Added youtube_link column to song table');
    }

    // Add createdAt column
    if (!tableInfo.createdAt) {
      await queryInterface.addColumn('song', 'createdAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Timestamp when record was created'
      });
      console.log('Added createdAt column to song table');
    }

    // Add updatedAt column
    if (!tableInfo.updatedAt) {
      await queryInterface.addColumn('song', 'updatedAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        comment: 'Timestamp when record was last updated'
      });
      console.log('Added updatedAt column to song table');
    }

    console.log('Migration completed: All missing song columns added');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Revert by removing all added columns
     */

    const tableInfo = await queryInterface.describeTable('song');

    if (tableInfo.duration) {
      await queryInterface.removeColumn('song', 'duration');
      console.log('Removed duration column from song table');
    }

    if (tableInfo.audio_file) {
      await queryInterface.removeColumn('song', 'audio_file');
      console.log('Removed audio_file column from song table');
    }

    if (tableInfo.spotify_link) {
      await queryInterface.removeColumn('song', 'spotify_link');
      console.log('Removed spotify_link column from song table');
    }

    if (tableInfo.apple_music_link) {
      await queryInterface.removeColumn('song', 'apple_music_link');
      console.log('Removed apple_music_link column from song table');
    }

    if (tableInfo.youtube_link) {
      await queryInterface.removeColumn('song', 'youtube_link');
      console.log('Removed youtube_link column from song table');
    }

    if (tableInfo.createdAt) {
      await queryInterface.removeColumn('song', 'createdAt');
      console.log('Removed createdAt column from song table');
    }

    if (tableInfo.updatedAt) {
      await queryInterface.removeColumn('song', 'updatedAt');
      console.log('Removed updatedAt column from song table');
    }

    console.log('Migration rollback completed: All added columns removed');
  }
};
