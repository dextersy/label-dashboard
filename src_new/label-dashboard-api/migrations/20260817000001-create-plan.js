'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('plan', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      price_monthly: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      price_annual: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },

      // Limits — NULL means unlimited
      limit_artists: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      limit_releases_per_artist: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      limit_press_campaigns_per_month: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      limit_sync_pitches_per_month: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      limit_storage_gb: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      limit_admin_users: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      // Default processing fees
      default_event_transaction_fixed_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      default_event_revenue_percentage_fee: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0,
      },
      default_event_fee_revenue_type: {
        type: Sequelize.ENUM('net', 'gross'),
        allowNull: true,
        defaultValue: 'net',
      },
      default_fundraiser_transaction_fixed_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      default_fundraiser_revenue_percentage_fee: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0,
      },
      default_fundraiser_fee_revenue_type: {
        type: Sequelize.ENUM('net', 'gross'),
        allowNull: true,
        defaultValue: 'net',
      },

      // Feature flags
      feature_music_workspace: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      feature_campaigns_workspace: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      feature_sublabels: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      feature_artist_profiles: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      feature_music_releases: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      feature_press_campaigns: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      feature_sync_licensing: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      feature_events: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      feature_fundraisers: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      is_public: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('plan');
    // Clean up ENUMs created by this migration
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_plan_default_event_fee_revenue_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_plan_default_fundraiser_fee_revenue_type";');
  },
};
