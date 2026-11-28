'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Backfill release_id on earning, royalty, and recuperable_expense rows
    // where the row has a product_id whose product is linked to a release,
    // but the row's own release_id is currently NULL.
    // After this migration, all financial queries can use release_id alone.

    await queryInterface.sequelize.query(`
      UPDATE earning
      SET release_id = p.release_id
      FROM product p
      WHERE earning.product_id = p.id
        AND p.release_id IS NOT NULL
        AND earning.release_id IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE royalty
      SET release_id = p.release_id
      FROM product p
      WHERE royalty.product_id = p.id
        AND p.release_id IS NOT NULL
        AND royalty.release_id IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE recuperable_expense
      SET release_id = p.release_id
      FROM product p
      WHERE recuperable_expense.product_id = p.id
        AND p.release_id IS NOT NULL
        AND recuperable_expense.release_id IS NULL
    `);
  },

  async down(queryInterface) {
    // Reverse: null out release_id on rows that have a product_id
    // (conservative — only removes release_id where a product link exists)
    await queryInterface.sequelize.query(`
      UPDATE earning
      SET release_id = NULL
      WHERE product_id IS NOT NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE royalty
      SET release_id = NULL
      WHERE product_id IS NOT NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE recuperable_expense
      SET release_id = NULL
      WHERE product_id IS NOT NULL
    `);
  }
};
