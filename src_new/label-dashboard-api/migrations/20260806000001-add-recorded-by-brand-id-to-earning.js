'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('earning', 'recorded_by_brand_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: { model: 'brand', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Backfill: treat all existing earnings as parent-recorded so the current
    // payable balances are preserved. We set recorded_by_brand_id to the
    // release's brand_id (non-null = counts toward payable balance).
    await queryInterface.sequelize.query(`
      UPDATE earning e
      SET recorded_by_brand_id = r.brand_id
      FROM release r
      WHERE e.release_id = r.id
        AND e.recorded_by_brand_id IS NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('earning', 'recorded_by_brand_id');
  },
};
