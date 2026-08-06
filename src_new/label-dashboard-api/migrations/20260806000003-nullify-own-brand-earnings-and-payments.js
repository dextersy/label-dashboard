'use strict';

/**
 * Production data-fix migration.
 *
 * The previous backfill (20260806000001) set recorded_by_brand_id = release.brand_id
 * for ALL existing earnings.  For the root parent label this means the label's own
 * directly-entered earnings (recorded by itself, not by a child brand) incorrectly
 * ended up with a non-null recorded_by_brand_id, making them appear as
 * "parent-payable" in the sublabel balance view.
 *
 * This migration nullifies recorded_by_brand_id on earnings where the recording
 * brand is the release's own brand (i.e. the label recorded its own earnings —
 * not a parent recording earnings on behalf of a child).
 *
 * Similarly, it nullifies paid_by_brand_id on payments where the paying brand is
 * the same as the artist's own brand (self-recorded payouts).
 *
 * Only rows belonging to the brand named "Melt Records" are affected.
 */
module.exports = {
  async up(queryInterface) {
    // Nullify recorded_by_brand_id on earnings that the label recorded for its own
    // releases (i.e. the brand that recorded the earning === the release's brand).
    await queryInterface.sequelize.query(`
      UPDATE earning e
      SET recorded_by_brand_id = NULL
      FROM release r
      JOIN brand b ON b.id = r.brand_id
      WHERE e.release_id = r.id
        AND e.recorded_by_brand_id = r.brand_id
        AND b.brand_name = 'Melt Records'
    `);

    // Nullify paid_by_brand_id on payments that the label recorded for its own
    // artists (i.e. the brand that paid === the artist's own brand).
    await queryInterface.sequelize.query(`
      UPDATE payment p
      SET paid_by_brand_id = NULL
      FROM artist a
      JOIN brand b ON b.id = a.brand_id
      WHERE p.artist_id = a.id
        AND p.paid_by_brand_id = a.brand_id
        AND b.brand_name = 'Melt Records'
    `);
  },

  async down(queryInterface) {
    // Re-apply the original backfill logic for Melt Records rows only.
    await queryInterface.sequelize.query(`
      UPDATE earning e
      SET recorded_by_brand_id = r.brand_id
      FROM release r
      JOIN brand b ON b.id = r.brand_id
      WHERE e.release_id = r.id
        AND e.recorded_by_brand_id IS NULL
        AND b.brand_name = 'Melt Records'
    `);

    await queryInterface.sequelize.query(`
      UPDATE payment p
      SET paid_by_brand_id = a.brand_id
      FROM artist a
      JOIN brand b ON b.id = a.brand_id
      WHERE p.artist_id = a.id
        AND p.paid_by_brand_id IS NULL
        AND b.brand_name = 'Melt Records'
    `);
  },
};
