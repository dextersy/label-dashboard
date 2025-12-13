'use strict';

/**
 * Migration: Normalize non-breaking spaces in text fields
 * 
 * This migration converts:
 * - HTML entity &nbsp; to regular space
 * - Unicode non-breaking space character (U+00A0) to regular space
 * 
 * Affected fields:
 * - release.description
 * - release.liner_notes
 * - event.description
 * 
 * This fixes text wrapping issues caused by Quill editor inserting
 * non-breaking space characters when users type spaces.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;
    
    console.log('Starting normalization of non-breaking spaces in text fields...\n');

    // Non-breaking space as a literal string for use in queries
    // U+00A0 = non-breaking space
    const nbsp = '\u00A0';

    try {
      // ========================================
      // 1. Normalize release.description
      // ========================================
      console.log('Processing release.description...');
      
      // Update &nbsp; HTML entities
      await queryInterface.sequelize.query(
        `UPDATE \`release\` 
         SET description = REPLACE(description, '&nbsp;', ' ')
         WHERE description IS NOT NULL`,
        { type: QueryTypes.RAW }
      );
      
      // Update Unicode non-breaking space using parameterized query
      await queryInterface.sequelize.query(
        `UPDATE \`release\` 
         SET description = REPLACE(description, ?, ' ')
         WHERE description IS NOT NULL`,
        { 
          type: QueryTypes.RAW,
          replacements: [nbsp]
        }
      );
      
      console.log('  - release.description processed');

      // ========================================
      // 2. Normalize release.liner_notes
      // ========================================
      console.log('Processing release.liner_notes...');
      
      // Update &nbsp; HTML entities
      await queryInterface.sequelize.query(
        `UPDATE \`release\` 
         SET liner_notes = REPLACE(liner_notes, '&nbsp;', ' ')
         WHERE liner_notes IS NOT NULL`,
        { type: QueryTypes.RAW }
      );
      
      // Update Unicode non-breaking space using parameterized query
      await queryInterface.sequelize.query(
        `UPDATE \`release\` 
         SET liner_notes = REPLACE(liner_notes, ?, ' ')
         WHERE liner_notes IS NOT NULL`,
        { 
          type: QueryTypes.RAW,
          replacements: [nbsp]
        }
      );
      
      console.log('  - release.liner_notes processed');

      // ========================================
      // 3. Normalize event.description
      // ========================================
      console.log('Processing event.description...');
      
      // Update &nbsp; HTML entities
      await queryInterface.sequelize.query(
        `UPDATE event 
         SET description = REPLACE(description, '&nbsp;', ' ')
         WHERE description IS NOT NULL`,
        { type: QueryTypes.RAW }
      );
      
      // Update Unicode non-breaking space using parameterized query
      await queryInterface.sequelize.query(
        `UPDATE event 
         SET description = REPLACE(description, ?, ' ')
         WHERE description IS NOT NULL`,
        { 
          type: QueryTypes.RAW,
          replacements: [nbsp]
        }
      );
      
      console.log('  - event.description processed');

      // ========================================
      // Summary
      // ========================================
      console.log('\n========================================');
      console.log('Migration completed successfully!');
      console.log('========================================');
      console.log('Fields processed:');
      console.log('  - release.description');
      console.log('  - release.liner_notes');
      console.log('  - event.description');
      console.log('========================================\n');

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // This migration is not reversible because we cannot determine
    // which spaces were originally non-breaking spaces vs regular spaces.
    console.log('This migration is not reversible.');
    console.log('Non-breaking spaces cannot be automatically restored.');
    console.log('No changes made during rollback.');
  }
};
