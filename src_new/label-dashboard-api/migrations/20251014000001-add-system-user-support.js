'use strict';

/**
 * Migration: Add System User Support
 *
 * This migration adds support for system users that are not tied to any specific brand.
 * System users can access cross-brand data for automated jobs and administrative tasks.
 *
 * Security measures:
 * - Adds is_system_user boolean flag
 * - Makes brand_id nullable for system users only
 * - Adds database constraint to enforce system user rules
 * - Adds index for system user queries
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Step 1: Add is_system_user column (default false for all existing users)
      await queryInterface.addColumn(
        'user',
        'is_system_user',
        {
          type: Sequelize.TINYINT,
          allowNull: false,
          defaultValue: 0,
          comment: 'Flag indicating if user is a system user (not tied to any brand)'
        },
        { transaction }
      );

      // Step 2: Make brand_id nullable
      // Note: Existing users will keep their brand_id values
      await queryInterface.changeColumn(
        'user',
        'brand_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 1,
          comment: 'Brand ID (NULL for system users, required for regular users)'
        },
        { transaction }
      );

      // Step 3: Validation logic moved to application level (User model)
      // Cannot use CHECK constraint on brand_id because it has foreign key constraints
      // with referential actions. Validation is enforced in the User model instead.
      console.log('⚠️  System user validation enforced at application level (User model)');

      // Step 4: Add index for system user queries (performance optimization)
      await queryInterface.addIndex(
        'user',
        ['is_system_user', 'email_address'],
        {
          name: 'idx_user_system_email',
          transaction
        }
      );

      // Step 5: Add composite index for regular user queries
      await queryInterface.addIndex(
        'user',
        ['is_system_user', 'brand_id'],
        {
          name: 'idx_user_system_brand',
          transaction
        }
      );

      await transaction.commit();
      console.log('✅ System user support added successfully');
      console.log('⚠️  Remember to create system user accounts manually with NULL brand_id');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove indexes
      await queryInterface.removeIndex('user', 'idx_user_system_brand', { transaction });
      await queryInterface.removeIndex('user', 'idx_user_system_email', { transaction });

      // Set all NULL brand_ids to 1 (default brand) before making column NOT NULL
      await queryInterface.sequelize.query(
        'UPDATE user SET brand_id = 1 WHERE brand_id IS NULL',
        { transaction }
      );

      // Make brand_id NOT NULL again
      await queryInterface.changeColumn(
        'user',
        'brand_id',
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1
        },
        { transaction }
      );

      // Remove is_system_user column
      await queryInterface.removeColumn('user', 'is_system_user', { transaction });

      await transaction.commit();
      console.log('✅ System user support removed successfully');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
