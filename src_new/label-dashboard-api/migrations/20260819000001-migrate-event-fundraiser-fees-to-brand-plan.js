'use strict';

/**
 * Event and fundraiser fee columns remain on the brand table but now use NULL to mean
 * "follow the subscribed plan's default fee". A value of 0 is a valid explicit override
 * meaning "no fee charged". This migration only removes the database-level DEFAULT 0 /
 * DEFAULT 'net' so that newly created brands start with NULL (plan defaults) rather than
 * inheriting a zero-fee override. Existing rows are left untouched.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove DEFAULT 0 so new brand rows default to NULL for these columns
    await queryInterface.sequelize.query(`
      ALTER TABLE brand
        ALTER COLUMN event_transaction_fixed_fee DROP DEFAULT,
        ALTER COLUMN event_revenue_percentage_fee DROP DEFAULT,
        ALTER COLUMN fundraiser_transaction_fixed_fee DROP DEFAULT,
        ALTER COLUMN fundraiser_revenue_percentage_fee DROP DEFAULT
    `);

    // Make the ENUM fee-type columns nullable and remove their DEFAULT 'net'
    // Use raw SQL to avoid Sequelize attempting a type cast on the existing ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE brand
        ALTER COLUMN event_fee_revenue_type DROP DEFAULT,
        ALTER COLUMN event_fee_revenue_type DROP NOT NULL,
        ALTER COLUMN fundraiser_fee_revenue_type DROP DEFAULT,
        ALTER COLUMN fundraiser_fee_revenue_type DROP NOT NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    // Restore DEFAULT 0
    await queryInterface.sequelize.query(`
      ALTER TABLE brand
        ALTER COLUMN event_transaction_fixed_fee SET DEFAULT 0,
        ALTER COLUMN event_revenue_percentage_fee SET DEFAULT 0,
        ALTER COLUMN fundraiser_transaction_fixed_fee SET DEFAULT 0,
        ALTER COLUMN fundraiser_revenue_percentage_fee SET DEFAULT 0
    `);

    // Restore ENUM columns to NOT NULL with default 'net'
    // Fill NULLs first before adding NOT NULL constraint
    await queryInterface.sequelize.query(`
      UPDATE brand SET event_fee_revenue_type = 'net' WHERE event_fee_revenue_type IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE brand SET fundraiser_fee_revenue_type = 'net' WHERE fundraiser_fee_revenue_type IS NULL
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE brand
        ALTER COLUMN event_fee_revenue_type SET NOT NULL,
        ALTER COLUMN event_fee_revenue_type SET DEFAULT 'net',
        ALTER COLUMN fundraiser_fee_revenue_type SET NOT NULL,
        ALTER COLUMN fundraiser_fee_revenue_type SET DEFAULT 'net'
    `);

    // Restore NULLed fee values to 0
    await queryInterface.sequelize.query(`
      UPDATE brand
      SET
        event_transaction_fixed_fee = COALESCE(event_transaction_fixed_fee, 0),
        event_revenue_percentage_fee = COALESCE(event_revenue_percentage_fee, 0),
        fundraiser_transaction_fixed_fee = COALESCE(fundraiser_transaction_fixed_fee, 0),
        fundraiser_revenue_percentage_fee = COALESCE(fundraiser_revenue_percentage_fee, 0)
    `);
  },
};
