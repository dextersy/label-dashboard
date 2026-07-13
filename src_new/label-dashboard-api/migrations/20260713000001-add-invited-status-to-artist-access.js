'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_artist_access_status" ADD VALUE IF NOT EXISTS 'Invited'`
    );
  },

  async down(queryInterface) {
    // PostgreSQL does not support removing enum values directly.
    // Recreate the type without 'Invited' by migrating existing rows first.
    await queryInterface.sequelize.query(`
      UPDATE "artist_access" SET "status" = 'Pending' WHERE "status" = 'Invited';
      ALTER TYPE "enum_artist_access_status" RENAME TO "enum_artist_access_status_old";
      CREATE TYPE "enum_artist_access_status" AS ENUM ('Pending', 'Accepted');
      ALTER TABLE "artist_access" ALTER COLUMN "status" TYPE "enum_artist_access_status"
        USING "status"::text::"enum_artist_access_status";
      DROP TYPE "enum_artist_access_status_old";
    `);
  }
};
