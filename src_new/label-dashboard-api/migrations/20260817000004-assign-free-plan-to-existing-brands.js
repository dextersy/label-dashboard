'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // Get the Free plan id
    const [plans] = await queryInterface.sequelize.query(
      `SELECT id FROM plan WHERE name = 'Free' LIMIT 1`
    );
    const freePlanId = plans[0]?.id;
    if (!freePlanId) throw new Error('Free plan not found — run the seed migration first.');

    // Get all brand ids that don't already have a plan assigned
    const [brands] = await queryInterface.sequelize.query(
      `SELECT b.id FROM brand b
       LEFT JOIN brand_plan bp ON bp.brand_id = b.id
       WHERE bp.id IS NULL`
    );

    if (brands.length === 0) return;

    const rows = brands.map((brand) => ({
      brand_id: brand.id,
      plan_id: freePlanId,
      billing_cycle: 'monthly',
      started_at: now,
      ends_at: null,
      override_limit_artists: null,
      override_limit_releases_per_artist: null,
      override_limit_press_campaigns_per_month: null,
      override_limit_sync_pitches_per_month: null,
      override_limit_storage_gb: null,
      override_limit_admin_users: null,
      createdAt: now,
      updatedAt: now,
    }));

    await queryInterface.bulkInsert('brand_plan', rows);
  },

  async down(queryInterface, Sequelize) {
    // Remove brand_plan rows that are on the Free plan and have no overrides
    // (i.e. rows created by this migration — don't touch manually assigned ones)
    await queryInterface.sequelize.query(
      `DELETE FROM brand_plan bp
       USING plan p
       WHERE p.id = bp.plan_id
         AND p.name = 'Free'
         AND bp.override_limit_artists IS NULL
         AND bp.override_limit_releases_per_artist IS NULL
         AND bp.override_limit_press_campaigns_per_month IS NULL
         AND bp.override_limit_sync_pitches_per_month IS NULL
         AND bp.override_limit_storage_gb IS NULL
         AND bp.override_limit_admin_users IS NULL`
    );
  },
};
