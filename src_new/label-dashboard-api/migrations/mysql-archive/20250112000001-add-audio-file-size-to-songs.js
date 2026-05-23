'use strict';

const AWS = require('aws-sdk');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add audio_file_size column to song table
     * Then backfill existing songs by checking S3 for file sizes
     */

    console.log('Starting migration: add-audio-file-size-to-songs');

    const tableInfo = await queryInterface.describeTable('song');

    // Add audio_file_size column if it doesn't exist
    if (!tableInfo.audio_file_size) {
      await queryInterface.addColumn('song', 'audio_file_size', {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: 'Audio master file size in bytes'
      });
      console.log('✓ Added audio_file_size column to song table');
    } else {
      console.log('⚠ audio_file_size column already exists, skipping column creation');
    }

    // Configure AWS S3
    AWS.config.update({
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
      region: process.env.S3_REGION
    });

    const s3 = new AWS.S3();
    const bucket = process.env.S3_BUCKET_MASTERS;

    if (!bucket) {
      console.log('⚠ S3_BUCKET_MASTERS not configured, skipping file size backfill');
      return;
    }

    // Get all songs with audio files
    const songs = await queryInterface.sequelize.query(
      'SELECT id, audio_file FROM song WHERE audio_file IS NOT NULL AND audio_file != ""',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!songs || songs.length === 0) {
      console.log('ℹ No songs with audio files found, skipping backfill');
      return;
    }

    console.log(`ℹ Found ${songs.length} songs with audio files, checking S3 for file sizes...`);

    let successCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;

    // Process each song
    for (const song of songs) {
      try {
        // Get file metadata from S3
        const headData = await s3.headObject({
          Bucket: bucket,
          Key: song.audio_file
        }).promise();

        const fileSize = headData.ContentLength;

        if (fileSize !== undefined && fileSize !== null) {
          // Update song with file size
          await queryInterface.sequelize.query(
            'UPDATE song SET audio_file_size = ? WHERE id = ?',
            {
              replacements: [fileSize, song.id],
              type: Sequelize.QueryTypes.UPDATE
            }
          );

          successCount++;
          console.log(`✓ Song ID ${song.id}: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
        } else {
          console.log(`⚠ Song ID ${song.id}: File size could not be determined`);
          errorCount++;
        }
      } catch (error) {
        if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
          console.log(`⚠ Song ID ${song.id}: File not found in S3 (${song.audio_file})`);
          notFoundCount++;
        } else {
          console.error(`✗ Song ID ${song.id}: Error getting file size - ${error.message}`);
          errorCount++;
        }
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total songs processed: ${songs.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Files not found: ${notFoundCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('Migration completed: add-audio-file-size-to-songs\n');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Revert by removing the audio_file_size column
     */

    console.log('Rolling back migration: add-audio-file-size-to-songs');

    const tableInfo = await queryInterface.describeTable('song');

    if (tableInfo.audio_file_size) {
      await queryInterface.removeColumn('song', 'audio_file_size');
      console.log('✓ Removed audio_file_size column from song table');
    }

    console.log('Migration rollback completed: add-audio-file-size-to-songs');
  }
};
