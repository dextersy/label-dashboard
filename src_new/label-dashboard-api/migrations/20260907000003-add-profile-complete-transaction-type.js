'use strict';

module.exports = {
  async up(queryInterface) {
    // PostgreSQL does not support ALTER ... MODIFY CHECK directly.
    // Drop the existing check constraint and recreate it with the new type included.
    await queryInterface.sequelize.query(`
      ALTER TABLE audience_point_transaction
        DROP CONSTRAINT IF EXISTS audience_point_transaction_type_check;

      ALTER TABLE audience_point_transaction
        ADD CONSTRAINT audience_point_transaction_type_check
          CHECK (type IN ('ticket_purchase', 'event_share', 'referral', 'profile_complete'));
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE audience_point_transaction
        DROP CONSTRAINT IF EXISTS audience_point_transaction_type_check;

      ALTER TABLE audience_point_transaction
        ADD CONSTRAINT audience_point_transaction_type_check
          CHECK (type IN ('ticket_purchase', 'event_share', 'referral'));
    `);
  },
};
