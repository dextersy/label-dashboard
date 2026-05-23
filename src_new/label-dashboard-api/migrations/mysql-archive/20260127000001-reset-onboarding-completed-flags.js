'use strict';

/**
 * Migration: Reset onboarding_completed flags for all users
 *
 * This migration resets the onboarding_completed flag to false for all users
 * so they can experience the updated onboarding flow with new steps for
 * Events and Fundraisers menus/selectors.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Resetting onboarding_completed flags for all users...');

    // Count users before update
    const [countResult] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as total, SUM(onboarding_completed) as completed FROM user'
    );
    const { total, completed } = countResult[0];

    console.log(`📊 Current status: ${completed || 0} of ${total} users have completed onboarding`);

    // Reset all onboarding_completed flags to false
    const [results] = await queryInterface.sequelize.query(
      'UPDATE user SET onboarding_completed = false WHERE onboarding_completed = true'
    );

    const affectedRows = results.affectedRows || results.rowCount || 0;

    console.log(`✅ Reset onboarding_completed to false for ${affectedRows} users`);
    console.log('');
    console.log('📝 All users will now see the updated onboarding flow on next login');
  },

  async down(queryInterface, Sequelize) {
    // Note: We cannot restore the original values since we don't track them
    // This down migration is a no-op with a warning
    console.log('⚠️  Cannot restore original onboarding_completed values');
    console.log('   This migration reset all flags to false and original values were not preserved.');
    console.log('');
    console.log('   If needed, you can manually set onboarding_completed = true for specific users:');
    console.log('   UPDATE user SET onboarding_completed = true WHERE id IN (...);');
  }
};
