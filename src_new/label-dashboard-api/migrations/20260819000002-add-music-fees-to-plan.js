'use strict';

/**
 * Extends the plan default fee structure to cover music earnings.
 *
 * 1. Adds default_music_* fee columns to the plan table (defaulting to 0 / 'net').
 * 2. Removes the database-level DEFAULT 0 / DEFAULT 'net' from the brand music
 *    fee columns so that NULL means "follow the subscribed plan's default" —
 *    the same semantic already used by event and fundraiser fee columns.
 * 3. Nullifies existing brand rows whose music fees are still at the zero defaults,
 *    so they automatically inherit from the plan going forward.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add default music fee columns to plan
    await queryInterface.addColumn('plan', 'default_music_transaction_fixed_fee', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('plan', 'default_music_revenue_percentage_fee', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('plan', 'default_music_fee_revenue_type', {
      type: Sequelize.ENUM('net', 'gross'),
      allowNull: true,
      defaultValue: 'net',
    });

    // 2. Remove DEFAULT 0 from brand music fee columns so NULL means "follow plan"
    await queryInterface.sequelize.query(`
      ALTER TABLE brand
        ALTER COLUMN music_transaction_fixed_fee DROP DEFAULT,
        ALTER COLUMN music_revenue_percentage_fee DROP DEFAULT
    `);

    // Make music_fee_revenue_type nullable and remove its DEFAULT 'net'
    await queryInterface.sequelize.query(`
      ALTER TABLE brand
        ALTER COLUMN music_fee_revenue_type DROP DEFAULT,
        ALTER COLUMN music_fee_revenue_type DROP NOT NULL
    `);

    // 3. Nullify brand rows still at the zero-fee defaults so they inherit from
    //    the plan default rather than being treated as explicit overrides
    await queryInterface.sequelize.query(`
      UPDATE brand
      SET
        music_transaction_fixed_fee = NULL,
        music_revenue_percentage_fee = NULL,
        music_fee_revenue_type = NULL
      WHERE
        (music_transaction_fixed_fee IS NULL OR music_transaction_fixed_fee = 0)
        AND (music_revenue_percentage_fee IS NULL OR music_revenue_percentage_fee = 0)
    `);
  },

  async down(queryInterface, Sequelize) {
    // Restore brand music fee columns to their previous NOT NULL / DEFAULT 0 state
    await queryInterface.sequelize.query(`
      UPDATE brand SET music_transaction_fixed_fee = 0 WHERE music_transaction_fixed_fee IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE brand SET music_revenue_percentage_fee = 0 WHERE music_revenue_percentage_fee IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE brand SET music_fee_revenue_type = 'net' WHERE music_fee_revenue_type IS NULL
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE brand
        ALTER COLUMN music_transaction_fixed_fee SET DEFAULT 0,
        ALTER COLUMN music_revenue_percentage_fee SET DEFAULT 0
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE brand
        ALTER COLUMN music_fee_revenue_type SET NOT NULL,
        ALTER COLUMN music_fee_revenue_type SET DEFAULT 'net'
    `);

    // Remove plan columns added in up()
    await queryInterface.removeColumn('plan', 'default_music_transaction_fixed_fee');
    await queryInterface.removeColumn('plan', 'default_music_revenue_percentage_fee');
    await queryInterface.removeColumn('plan', 'default_music_fee_revenue_type');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_plan_default_music_fee_revenue_type";');
  },
};
