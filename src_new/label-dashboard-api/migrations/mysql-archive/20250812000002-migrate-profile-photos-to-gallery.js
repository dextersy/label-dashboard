'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get all artists with profile_photo URLs
    const artists = await queryInterface.sequelize.query(
      'SELECT id, profile_photo FROM artist WHERE profile_photo IS NOT NULL AND profile_photo != ""',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    console.log(`Found ${artists.length} artists with profile photos to migrate`);

    for (const artist of artists) {
      try {
        // Check if this profile photo already exists in artist_image table
        const existingImage = await queryInterface.sequelize.query(
          'SELECT id FROM artist_image WHERE artist_id = ? AND path = ?',
          {
            replacements: [artist.id, artist.profile_photo],
            type: queryInterface.sequelize.QueryTypes.SELECT
          }
        );

        let imageId;

        if (existingImage.length > 0) {
          // Use existing image
          imageId = existingImage[0].id;
          console.log(`Using existing gallery image ${imageId} for artist ${artist.id}`);
        } else {
          // Create new gallery entry
          const [newImage] = await queryInterface.sequelize.query(
            'INSERT INTO artist_image (path, artist_id, date_uploaded) VALUES (?, ?, NOW())',
            {
              replacements: [artist.profile_photo, artist.id],
              type: queryInterface.sequelize.QueryTypes.INSERT
            }
          );
          imageId = newImage;
          console.log(`Created new gallery image ${imageId} for artist ${artist.id}`);
        }

        // Update artist to reference the gallery image
        await queryInterface.sequelize.query(
          'UPDATE artist SET profile_photo_id = ? WHERE id = ?',
          {
            replacements: [imageId, artist.id],
            type: queryInterface.sequelize.QueryTypes.UPDATE
          }
        );

        console.log(`Updated artist ${artist.id} to use gallery image ${imageId}`);
      } catch (error) {
        console.error(`Error migrating profile photo for artist ${artist.id}:`, error.message);
        // Continue with other artists even if one fails
      }
    }

    console.log('Profile photo migration completed');
  },

  async down(queryInterface, Sequelize) {
    // Get all artists with profile_photo_id
    const artists = await queryInterface.sequelize.query(
      `SELECT a.id, a.profile_photo_id, ai.path 
       FROM artist a 
       JOIN artist_image ai ON a.profile_photo_id = ai.id 
       WHERE a.profile_photo_id IS NOT NULL`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    console.log(`Reverting ${artists.length} artists back to profile_photo URLs`);

    for (const artist of artists) {
      try {
        // Update artist to use the path from the gallery as profile_photo
        await queryInterface.sequelize.query(
          'UPDATE artist SET profile_photo = ?, profile_photo_id = NULL WHERE id = ?',
          {
            replacements: [artist.path, artist.id],
            type: queryInterface.sequelize.QueryTypes.UPDATE
          }
        );

        console.log(`Reverted artist ${artist.id} to use profile_photo URL: ${artist.path}`);
      } catch (error) {
        console.error(`Error reverting profile photo for artist ${artist.id}:`, error.message);
      }
    }

    // Note: We don't delete the gallery images as they might be used elsewhere
    // The admin can manually clean up duplicate gallery entries if needed

    console.log('Profile photo reversion completed');
  }
};