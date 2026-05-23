'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Remove columns from song table that are no longer used in the current model
     * These are legacy columns from the old schema
     */

    console.log('Removing unused columns from song table...');

    const tableInfo = await queryInterface.describeTable('song');

    // Remove title_language
    if (tableInfo.title_language) {
      await queryInterface.removeColumn('song', 'title_language');
      console.log('Removed column: title_language');
    }

    // Remove master_url (replaced by audio_file)
    if (tableInfo.master_url) {
      await queryInterface.removeColumn('song', 'master_url');
      console.log('Removed column: master_url');
    }

    // Remove lyrics_language
    if (tableInfo.lyrics_language) {
      await queryInterface.removeColumn('song', 'lyrics_language');
      console.log('Removed column: lyrics_language');
    }

    // Remove is_instrumental
    if (tableInfo.is_instrumental) {
      await queryInterface.removeColumn('song', 'is_instrumental');
      console.log('Removed column: is_instrumental');
    }

    // Remove is_cover
    if (tableInfo.is_cover) {
      await queryInterface.removeColumn('song', 'is_cover');
      console.log('Removed column: is_cover');
    }

    // Remove is_studio_recording
    if (tableInfo.is_studio_recording) {
      await queryInterface.removeColumn('song', 'is_studio_recording');
      console.log('Removed column: is_studio_recording');
    }

    console.log('Successfully removed all unused columns from song table');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Revert by re-adding the removed columns
     * WARNING: This will add empty columns - original data cannot be recovered
     */

    console.log('Re-adding previously removed columns to song table...');

    const tableInfo = await queryInterface.describeTable('song');

    // Re-add title_language
    if (!tableInfo.title_language) {
      await queryInterface.addColumn('song', 'title_language', {
        type: Sequelize.STRING(45),
        allowNull: false,
        defaultValue: 'en'
      });
      console.log('Re-added column: title_language');
    }

    // Re-add master_url
    if (!tableInfo.master_url) {
      await queryInterface.addColumn('song', 'master_url', {
        type: Sequelize.STRING(1024),
        allowNull: true
      });
      console.log('Re-added column: master_url');
    }

    // Re-add lyrics_language
    if (!tableInfo.lyrics_language) {
      await queryInterface.addColumn('song', 'lyrics_language', {
        type: Sequelize.STRING(45),
        allowNull: true
      });
      console.log('Re-added column: lyrics_language');
    }

    // Re-add is_instrumental
    if (!tableInfo.is_instrumental) {
      await queryInterface.addColumn('song', 'is_instrumental', {
        type: Sequelize.TINYINT,
        allowNull: true
      });
      console.log('Re-added column: is_instrumental');
    }

    // Re-add is_cover
    if (!tableInfo.is_cover) {
      await queryInterface.addColumn('song', 'is_cover', {
        type: Sequelize.TINYINT,
        allowNull: true
      });
      console.log('Re-added column: is_cover');
    }

    // Re-add is_studio_recording
    if (!tableInfo.is_studio_recording) {
      await queryInterface.addColumn('song', 'is_studio_recording', {
        type: Sequelize.TINYINT,
        allowNull: true
      });
      console.log('Re-added column: is_studio_recording');
    }

    console.log('Rollback completed: All columns re-added to song table');
  }
};
