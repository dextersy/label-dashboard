'use strict';

/**
 * Restores the state prior to the accidentally-run migration that changed
 * paid_by_brand_id from the parent brand ID to the sublabel's own brand ID
 * for all sublabel artists across all brands.
 *
 * For sublabels, payments are attributed to the parent brand — this restores
 * that convention for all brands where parent_brand IS NOT NULL.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE payment p
      SET paid_by_brand_id = b.parent_brand
      FROM artist a
      JOIN brand b ON b.id = a.brand_id
      WHERE p.artist_id = a.id
        AND b.parent_brand IS NOT NULL
        AND p.paid_by_brand_id = a.brand_id
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE payment p
      SET paid_by_brand_id = a.brand_id
      FROM artist a
      JOIN brand b ON b.id = a.brand_id
      WHERE p.artist_id = a.id
        AND b.parent_brand IS NOT NULL
        AND p.paid_by_brand_id = b.parent_brand
    `);
  },
};
