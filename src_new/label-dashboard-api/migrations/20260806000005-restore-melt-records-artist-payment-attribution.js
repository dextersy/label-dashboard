'use strict';

/**
 * Data-fix migration.
 *
 * Migration 000003 incorrectly nullified paid_by_brand_id for payments to
 * artists directly under Melt Records. This caused all their payments to appear
 * as "by parent" on the financial summary cards because the own_payments query
 * filters paid_by_brand_id = req.user.brand_id, which NULL never matches.
 *
 * Migration 000002 had it right for these artists: COALESCE(b.parent_brand,
 * a.brand_id) correctly resolves to a.brand_id (the label itself) when there
 * is no parent. This migration restores that attribution.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE payment p
      SET paid_by_brand_id = a.brand_id
      FROM artist a
      JOIN brand b ON b.id = a.brand_id
      WHERE p.artist_id = a.id
        AND p.paid_by_brand_id IS NULL
        AND b.parent_brand IS NULL
        AND b.brand_name = 'Melt Records'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE payment p
      SET paid_by_brand_id = NULL
      FROM artist a
      JOIN brand b ON b.id = a.brand_id
      WHERE p.artist_id = a.id
        AND p.paid_by_brand_id = a.brand_id
        AND b.parent_brand IS NULL
        AND b.brand_name = 'Melt Records'
    `);
  },
};
