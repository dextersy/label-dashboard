'use strict';

/**
 * Migration: Add password_hash column for bcrypt password hashing
 *
 * This migration supports the lazy migration strategy from MD5 to bcrypt:
 * - Adds password_hash column (VARCHAR 60) for bcrypt hashes
 * - Keeps password_md5 column for backward compatibility (set to NULL on migration)
 * - New users will use password_hash only
 * - Existing users will migrate from password_md5 to password_hash on next login
 * - MD5 hash is removed immediately upon successful migration
 *
 * Security benefits:
 * - MD5: Fast, no salt, vulnerable to rainbow tables
 * - bcrypt: Slow (brute-force resistant), auto-salted, industry standard
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if password_hash column already exists
    const tableInfo = await queryInterface.describeTable('user');

    if (!tableInfo.password_hash) {
      console.log('Adding password_hash column to user table...');

      await queryInterface.addColumn('user', 'password_hash', {
        type: Sequelize.STRING(60),
        allowNull: true,
        after: 'password_md5',
        comment: 'Bcrypt password hash (replaces insecure MD5)'
      });

      console.log('✅ Added password_hash column');
      console.log('');
      console.log('🔐 Password migration strategy:');
      console.log('   - New users: bcrypt only');
      console.log('   - Existing MD5 users: Migrate on next login');
      console.log('   - Password resets: bcrypt only');
      console.log('');
      console.log('📊 Monitor migration progress:');
      console.log('   SELECT COUNT(*) as total,');
      console.log('     SUM(password_hash IS NOT NULL) as migrated,');
      console.log('     ROUND(SUM(password_hash IS NOT NULL) * 100.0 / COUNT(*), 2) as percent');
      console.log('   FROM user WHERE password_md5 IS NOT NULL OR password_hash IS NOT NULL;');
    } else {
      console.log('⚠️  password_hash column already exists, skipping...');
    }
  },

  async down(queryInterface, Sequelize) {
    // Check if password_hash column exists before removing
    const tableInfo = await queryInterface.describeTable('user');

    if (tableInfo.password_hash) {
      console.log('⚠️  WARNING: Rolling back password_hash migration');
      console.log('   This will remove bcrypt hashes and force users back to MD5');
      console.log('   Users who migrated will need to reset their passwords!');
      console.log('');

      // Remove column
      await queryInterface.removeColumn('user', 'password_hash');
      console.log('✅ Removed password_hash column');
      console.log('');
      console.log('❌ Migration rolled back - users reverted to MD5 passwords');
    } else {
      console.log('⚠️  password_hash column does not exist, skipping rollback...');
    }
  }
};
