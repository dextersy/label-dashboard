'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Fix the id column in song table to be AUTO_INCREMENT
     * Production database has id as primary key but without auto_increment
     * Need to drop foreign keys first, modify column, then re-add foreign keys
     */

    console.log('Step 1: Dropping foreign key constraints from tables referencing song.id...');

    // Drop foreign key from song_collaborator
    await queryInterface.sequelize.query(`
      ALTER TABLE song_collaborator
      DROP FOREIGN KEY song_collaborator_ibfk_1
    `);
    console.log('Dropped FK: song_collaborator_ibfk_1');

    // Drop foreign key from song_author
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE song_author
        DROP FOREIGN KEY song_author_ibfk_1
      `);
      console.log('Dropped FK: song_author_ibfk_1');
    } catch (e) {
      console.log('FK song_author_ibfk_1 does not exist, skipping...');
    }

    // Drop foreign key from song_composer
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE song_composer
        DROP FOREIGN KEY song_composer_ibfk_1
      `);
      console.log('Dropped FK: song_composer_ibfk_1');
    } catch (e) {
      console.log('FK song_composer_ibfk_1 does not exist, skipping...');
    }

    console.log('Step 2: Modifying song.id column to add AUTO_INCREMENT...');

    // Modify the id column to add AUTO_INCREMENT
    await queryInterface.sequelize.query(`
      ALTER TABLE song
      MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT
    `);

    console.log('Step 3: Re-adding foreign key constraints...');

    // Re-add foreign key to song_collaborator
    await queryInterface.sequelize.query(`
      ALTER TABLE song_collaborator
      ADD CONSTRAINT song_collaborator_ibfk_1
      FOREIGN KEY (song_id) REFERENCES song(id)
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);
    console.log('Re-added FK: song_collaborator_ibfk_1');

    // Re-add foreign key to song_author
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE song_author
        ADD CONSTRAINT song_author_ibfk_1
        FOREIGN KEY (song_id) REFERENCES song(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
      `);
      console.log('Re-added FK: song_author_ibfk_1');
    } catch (e) {
      console.log('Could not re-add FK song_author_ibfk_1, may not be needed');
    }

    // Re-add foreign key to song_composer
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE song_composer
        ADD CONSTRAINT song_composer_ibfk_1
        FOREIGN KEY (song_id) REFERENCES song(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
      `);
      console.log('Re-added FK: song_composer_ibfk_1');
    } catch (e) {
      console.log('Could not re-add FK song_composer_ibfk_1, may not be needed');
    }

    console.log('Successfully added AUTO_INCREMENT to song.id column');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Revert by removing AUTO_INCREMENT from id column
     * WARNING: This is destructive and should only be used if absolutely necessary
     */

    console.log('Removing AUTO_INCREMENT from song.id column...');

    // Drop foreign keys
    await queryInterface.sequelize.query(`
      ALTER TABLE song_collaborator
      DROP FOREIGN KEY song_collaborator_ibfk_1
    `);

    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE song_author
        DROP FOREIGN KEY song_author_ibfk_1
      `);
    } catch (e) {}

    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE song_composer
        DROP FOREIGN KEY song_composer_ibfk_1
      `);
    } catch (e) {}

    // Remove AUTO_INCREMENT
    await queryInterface.sequelize.query(`
      ALTER TABLE song
      MODIFY COLUMN id INT NOT NULL
    `);

    // Re-add foreign keys
    await queryInterface.sequelize.query(`
      ALTER TABLE song_collaborator
      ADD CONSTRAINT song_collaborator_ibfk_1
      FOREIGN KEY (song_id) REFERENCES song(id)
    `);

    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE song_author
        ADD CONSTRAINT song_author_ibfk_1
        FOREIGN KEY (song_id) REFERENCES song(id)
      `);
    } catch (e) {}

    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE song_composer
        ADD CONSTRAINT song_composer_ibfk_1
        FOREIGN KEY (song_id) REFERENCES song(id)
      `);
    } catch (e) {}

    console.log('Removed AUTO_INCREMENT from song.id column');
  }
};
