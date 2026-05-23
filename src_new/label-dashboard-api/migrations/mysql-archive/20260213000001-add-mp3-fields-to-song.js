'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Starting migration: add-mp3-fields-to-song');

    const tableInfo = await queryInterface.describeTable('song');

    if (!tableInfo.audio_file_mp3) {
      await queryInterface.addColumn('song', 'audio_file_mp3', {
        type: Sequelize.STRING(255),
        allowNull: true,
        after: 'audio_file',
        comment: 'S3 key for the MP3 version of the audio master'
      });
      console.log('✓ Added audio_file_mp3 column to song table');
    } else {
      console.log('⚠ audio_file_mp3 column already exists, skipping');
    }

    if (!tableInfo.audio_file_mp3_size) {
      await queryInterface.addColumn('song', 'audio_file_mp3_size', {
        type: Sequelize.BIGINT,
        allowNull: true,
        after: 'audio_file_size',
        comment: 'MP3 file size in bytes'
      });
      console.log('✓ Added audio_file_mp3_size column to song table');
    } else {
      console.log('⚠ audio_file_mp3_size column already exists, skipping');
    }

    console.log('Migration completed: add-mp3-fields-to-song');
  },

  async down(queryInterface, Sequelize) {
    console.log('Rolling back migration: add-mp3-fields-to-song');

    const tableInfo = await queryInterface.describeTable('song');

    if (tableInfo.audio_file_mp3_size) {
      await queryInterface.removeColumn('song', 'audio_file_mp3_size');
      console.log('✓ Removed audio_file_mp3_size column');
    }

    if (tableInfo.audio_file_mp3) {
      await queryInterface.removeColumn('song', 'audio_file_mp3');
      console.log('✓ Removed audio_file_mp3 column');
    }

    console.log('Migration rollback completed: add-mp3-fields-to-song');
  }
};
