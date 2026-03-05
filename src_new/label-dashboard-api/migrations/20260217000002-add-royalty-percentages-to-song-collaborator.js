'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add per-type royalty percentage and type columns to song_collaborator
    // Mirrors the fields on release_artist; default to 0 until backfill runs
    await queryInterface.addColumn('song_collaborator', 'streaming_royalty_percentage', {
      type: Sequelize.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn('song_collaborator', 'streaming_royalty_type', {
      type: Sequelize.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue'
    });

    await queryInterface.addColumn('song_collaborator', 'sync_royalty_percentage', {
      type: Sequelize.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn('song_collaborator', 'sync_royalty_type', {
      type: Sequelize.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue'
    });

    await queryInterface.addColumn('song_collaborator', 'download_royalty_percentage', {
      type: Sequelize.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn('song_collaborator', 'download_royalty_type', {
      type: Sequelize.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue'
    });

    await queryInterface.addColumn('song_collaborator', 'physical_royalty_percentage', {
      type: Sequelize.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn('song_collaborator', 'physical_royalty_type', {
      type: Sequelize.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue'
    });

    // Backfill: for each song_collaborator, find the first release containing the song
    // (lowest release_song.id) and copy royalty percentages from release_artist.
    // If the artist is not in release_artist for that release, percentages stay 0.
    await queryInterface.sequelize.query(`
      UPDATE song_collaborator sc
      INNER JOIN (
        SELECT
          sc2.id,
          COALESCE(ra.streaming_royalty_percentage, 0) AS streaming_royalty_percentage,
          COALESCE(ra.streaming_royalty_type, 'Revenue') AS streaming_royalty_type,
          COALESCE(ra.sync_royalty_percentage, 0) AS sync_royalty_percentage,
          COALESCE(ra.sync_royalty_type, 'Revenue') AS sync_royalty_type,
          COALESCE(ra.download_royalty_percentage, 0) AS download_royalty_percentage,
          COALESCE(ra.download_royalty_type, 'Revenue') AS download_royalty_type,
          COALESCE(ra.physical_royalty_percentage, 0) AS physical_royalty_percentage,
          COALESCE(ra.physical_royalty_type, 'Revenue') AS physical_royalty_type
        FROM song_collaborator sc2
        LEFT JOIN release_song rs
          ON rs.song_id = sc2.song_id
          AND rs.id = (
            SELECT MIN(rs2.id) FROM release_song rs2 WHERE rs2.song_id = sc2.song_id
          )
        LEFT JOIN release_artist ra
          ON ra.release_id = rs.release_id
          AND ra.artist_id = sc2.artist_id
      ) vals ON sc.id = vals.id
      SET
        sc.streaming_royalty_percentage = vals.streaming_royalty_percentage,
        sc.streaming_royalty_type       = vals.streaming_royalty_type,
        sc.sync_royalty_percentage      = vals.sync_royalty_percentage,
        sc.sync_royalty_type            = vals.sync_royalty_type,
        sc.download_royalty_percentage  = vals.download_royalty_percentage,
        sc.download_royalty_type        = vals.download_royalty_type,
        sc.physical_royalty_percentage  = vals.physical_royalty_percentage,
        sc.physical_royalty_type        = vals.physical_royalty_type
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('song_collaborator', 'streaming_royalty_percentage');
    await queryInterface.removeColumn('song_collaborator', 'streaming_royalty_type');
    await queryInterface.removeColumn('song_collaborator', 'sync_royalty_percentage');
    await queryInterface.removeColumn('song_collaborator', 'sync_royalty_type');
    await queryInterface.removeColumn('song_collaborator', 'download_royalty_percentage');
    await queryInterface.removeColumn('song_collaborator', 'download_royalty_type');
    await queryInterface.removeColumn('song_collaborator', 'physical_royalty_percentage');
    await queryInterface.removeColumn('song_collaborator', 'physical_royalty_type');
  }
};
