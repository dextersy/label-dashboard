'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_event_status" ADD VALUE IF NOT EXISTS 'canceled';`
    );
  },

  async down() {
    // PostgreSQL does not support removing ENUM values without recreating the type.
    // Downgrade manually if needed.
  }
};
