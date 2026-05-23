'use strict';

/**
 * Migration: Add onboarding_completed column to track user onboarding status
 *
 * This migration adds a boolean flag to track whether users have completed
 * the onboarding flow for the new workspace-based UI.
 *
 * - Adds onboarding_completed column (BOOLEAN, default false)
 * - Existing users will see onboarding on first login after migration
 * - New users will see onboarding on account creation
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if onboarding_completed column already exists
    const tableInfo = await queryInterface.describeTable('user');

    if (!tableInfo.onboarding_completed) {
      console.log('Adding onboarding_completed column to user table...');

      await queryInterface.addColumn('user', 'onboarding_completed', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Tracks whether user has completed the UI onboarding flow'
      });

      console.log('✅ Added onboarding_completed column');
      console.log('');
      console.log('📊 Onboarding tracking enabled:');
      console.log('   - Existing users: Will see onboarding on next login');
      console.log('   - New users: Will see onboarding after signup');
      console.log('   - Track completion rate:');
      console.log('     SELECT COUNT(*) as total,');
      console.log('       SUM(onboarding_completed) as completed,');
      console.log('       ROUND(SUM(onboarding_completed) * 100.0 / COUNT(*), 2) as percent');
      console.log('     FROM user;');
    } else {
      console.log('⚠️  onboarding_completed column already exists, skipping...');
    }
  },

  async down(queryInterface, Sequelize) {
    // Check if onboarding_completed column exists before removing
    const tableInfo = await queryInterface.describeTable('user');

    if (tableInfo.onboarding_completed) {
      console.log('⚠️  Rolling back onboarding_completed migration');

      // Remove column
      await queryInterface.removeColumn('user', 'onboarding_completed');
      console.log('✅ Removed onboarding_completed column');
      console.log('');
      console.log('❌ Onboarding tracking disabled');
    } else {
      console.log('⚠️  onboarding_completed column does not exist, skipping rollback...');
    }
  }
};
