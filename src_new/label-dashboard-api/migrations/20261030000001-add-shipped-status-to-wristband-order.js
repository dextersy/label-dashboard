'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_wristband_order_status" ADD VALUE IF NOT EXISTS 'shipped'`
    );
  },

  async down() {
    // PostgreSQL does not support removing values from an ENUM type.
    // To roll back, recreate the type without 'shipped' and migrate data manually.
  },
};
