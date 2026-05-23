'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, add the new enum values to the existing ENUM
    await queryInterface.changeColumn('domain', 'status', {
      type: Sequelize.ENUM('Unverified', 'Pending', 'No SSL', 'Connected', 'Verified'),
      allowNull: true,
      defaultValue: 'Unverified'
    });

    // Update existing 'Verified' status to 'No SSL' since we cannot guarantee SSL is configured
    await queryInterface.sequelize.query(
      "UPDATE `domain` SET `status` = 'No SSL' WHERE `status` = 'Verified';"
    );

    // Remove the old 'Verified' value from the enum by recreating it without 'Verified'
    await queryInterface.changeColumn('domain', 'status', {
      type: Sequelize.ENUM('Unverified', 'Pending', 'No SSL', 'Connected'),
      allowNull: true,
      defaultValue: 'Unverified'
    });

    // Add indexes for better query performance on status
    try {
      await queryInterface.addIndex('domain', ['status'], {
        name: 'idx_domain_status'
      });
    } catch (error) {
      // Index might already exist, ignore error
      console.log('Index idx_domain_status might already exist:', error.message);
    }

    try {
      await queryInterface.addIndex('domain', ['brand_id', 'status'], {
        name: 'idx_domain_brand_status'
      });
    } catch (error) {
      // Index might already exist, ignore error
      console.log('Index idx_domain_brand_status might already exist:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove the indexes
    try {
      await queryInterface.removeIndex('domain', 'idx_domain_status');
    } catch (error) {
      console.log('Index idx_domain_status might not exist:', error.message);
    }

    try {
      await queryInterface.removeIndex('domain', 'idx_domain_brand_status');
    } catch (error) {
      console.log('Index idx_domain_brand_status might not exist:', error.message);
    }

    // Revert the enum to the original state (assuming original was just 'Verified')
    // First update any new status values to 'Verified'
    await queryInterface.sequelize.query(
      "UPDATE `domain` SET `status` = 'Verified' WHERE `status` IN ('Unverified', 'Pending', 'No SSL', 'Connected');"
    );

    // Restore original enum
    await queryInterface.changeColumn('domain', 'status', {
      type: Sequelize.ENUM('Verified'),
      allowNull: true,
      defaultValue: 'Verified'
    });
  }
};