'use strict';

/**
 * Adds file_size columns (BIGINT, bytes) to every table whose S3 uploads
 * count toward a brand's storage quota:
 *
 *   artist_image              → file_size
 *   artist_documents          → file_size
 *   release                   → cover_art_file_size
 *   press_campaign            → cover_art_file_size, mp3_file_size
 *   press_campaign_artist_photo → file_size
 *
 * Note: song.audio_file_size / audio_file_mp3_size already exist.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('artist_image', 'file_size', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });

    await queryInterface.addColumn('artist_documents', 'file_size', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });

    await queryInterface.addColumn('release', 'cover_art_file_size', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });

    await queryInterface.addColumn('press_campaign', 'cover_art_file_size', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });

    await queryInterface.addColumn('press_campaign', 'mp3_file_size', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });

    await queryInterface.addColumn('press_campaign_artist_photo', 'file_size', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('artist_image', 'file_size');
    await queryInterface.removeColumn('artist_documents', 'file_size');
    await queryInterface.removeColumn('release', 'cover_art_file_size');
    await queryInterface.removeColumn('press_campaign', 'cover_art_file_size');
    await queryInterface.removeColumn('press_campaign', 'mp3_file_size');
    await queryInterface.removeColumn('press_campaign_artist_photo', 'file_size');
  },
};
