'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Add release artists as collaborators for all existing songs
    // This ensures that all songs have their release artists as collaborators
    await queryInterface.sequelize.query(`
      INSERT INTO song_collaborator (song_id, artist_id, role, createdAt, updatedAt)
      SELECT DISTINCT
        s.id,
        ra.artist_id,
        NULL,
        NOW(),
        NOW()
      FROM song s
      INNER JOIN \`release\` r ON s.release_id = r.id
      INNER JOIN release_artist ra ON r.id = ra.release_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM song_collaborator sc
        WHERE sc.song_id = s.id
        AND sc.artist_id = ra.artist_id
      );
    `);

    // Step 2: Remove the 'role' column from song_collaborator table
    await queryInterface.removeColumn('song_collaborator', 'role');
  },

  async down(queryInterface, Sequelize) {
    // Step 1: Re-add the 'role' column
    await queryInterface.addColumn('song_collaborator', 'role', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Role in the song (e.g., Featured Artist, Vocalist, etc.)'
    });

    // Step 2: Remove auto-added release artist collaborators
    // This is complex to reverse perfectly, so we'll just leave them
    // as removing them might delete manually added collaborators that happen
    // to match release artists. The 'role' column being NULL will distinguish
    // auto-added ones from manual ones if needed for debugging.
    console.log('Note: Auto-added release artist collaborators have been retained with role=NULL');
  }
};
