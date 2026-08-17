'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('brand_plan', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'brand',
          key: 'id',
        },
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      },
      plan_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'plan',
          key: 'id',
        },
        onUpdate: 'NO ACTION',
        onDelete: 'RESTRICT',
      },
      billing_cycle: {
        type: Sequelize.ENUM('monthly', 'annual'),
        allowNull: false,
        defaultValue: 'monthly',
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      ends_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // Per-brand limit overrides — NULL means "use the plan's value"
      override_limit_artists: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      override_limit_releases_per_artist: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      override_limit_press_campaigns_per_month: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      override_limit_sync_pitches_per_month: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      override_limit_storage_gb: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      override_limit_admin_users: {
        type: Sequelize.INTEGER,
        allowNull: true,
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

    await queryInterface.addIndex('brand_plan', ['brand_id'], {
      name: 'idx_brand_plan_brand_id',
    });
    await queryInterface.addIndex('brand_plan', ['plan_id'], {
      name: 'idx_brand_plan_plan_id',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('brand_plan');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_brand_plan_billing_cycle";');
  },
};
