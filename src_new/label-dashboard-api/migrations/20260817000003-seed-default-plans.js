'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // ON CONFLICT DO NOTHING makes this idempotent — safe to re-run after rollback.
    // Requires a unique constraint on "name" (added in migration 1).
    await queryInterface.sequelize.query(`
      INSERT INTO plan (
        name, price_monthly, price_annual,
        limit_artists, limit_releases_per_artist,
        limit_press_campaigns_per_month, limit_sync_pitches_per_month,
        limit_storage_gb, limit_admin_users,
        default_event_transaction_fixed_fee, default_event_revenue_percentage_fee, default_event_fee_revenue_type,
        default_fundraiser_transaction_fixed_fee, default_fundraiser_revenue_percentage_fee, default_fundraiser_fee_revenue_type,
        feature_music_workspace, feature_campaigns_workspace, feature_sublabels,
        feature_artist_profiles, feature_music_releases, feature_press_campaigns,
        feature_sync_licensing, feature_events, feature_fundraisers,
        is_active, is_public, sort_order, "createdAt", "updatedAt"
      ) VALUES
        ('Free',         0,   0,    3,    3, 1, 1, 2,    NULL, 0, 8,   'gross', 0, 5,   'gross', TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,  0, :now, :now),
        ('Starter',      149, 1490, 5,    5, 2, 2, 10,   NULL, 0, 6.5, 'gross', 0, 3.5, 'gross', TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,  1, :now, :now),
        ('Pro',          349, 3490, 15,   10, 5, 5, 40,   NULL, 0, 5.5, 'gross', 0, 3,   'gross', TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,  2, :now, :now),
        ('Unlimited',    599, 5990, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0,   'net',   0, 0,   'net',   TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,  3, :now, :now),
        ('Distribution', 0,   0,    NULL, NULL, NULL, NULL, NULL, NULL, 0, 5,   'gross', 0, 3,   'gross', TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, 4, :now, :now)
      ON CONFLICT (name) DO NOTHING
    `, { replacements: { now } });

  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('plan', {
      name: ['Free', 'Starter', 'Pro', 'Unlimited', 'Distribution'],
    });
  },
};
