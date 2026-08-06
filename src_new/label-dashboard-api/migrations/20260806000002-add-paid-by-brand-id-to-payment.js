'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('payment', 'paid_by_brand_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'brand',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Backfill: treat all historical payments as parent-initiated.
    // For artists under a sublabel, attribute the payment to the parent brand.
    // For artists under a top-level label (no parent), attribute to their own brand.
    await queryInterface.sequelize.query(`
      UPDATE payment p
      SET paid_by_brand_id = COALESCE(b.parent_brand, a.brand_id)
      FROM artist a
      JOIN brand b ON b.id = a.brand_id
      WHERE p.artist_id = a.id
        AND p.paid_by_brand_id IS NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('payment', 'paid_by_brand_id');
  },
};
