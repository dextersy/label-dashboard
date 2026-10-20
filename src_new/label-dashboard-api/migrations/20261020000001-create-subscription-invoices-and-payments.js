'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscription_invoices', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'brand', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      plan_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'plan', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      billing_cycle: {
        type: Sequelize.ENUM('monthly', 'annual'),
        allowNull: false,
      },
      invoice_number: {
        type: Sequelize.STRING(32),
        allowNull: false,
        unique: true,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'PHP',
      },
      status: {
        type: Sequelize.ENUM('open', 'paid', 'void', 'uncollectible'),
        allowNull: false,
        defaultValue: 'open',
      },
      billing_reason: {
        type: Sequelize.ENUM('subscription_create', 'subscription_cycle', 'subscription_update'),
        allowNull: false,
      },
      period_start: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      period_end: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      paypal_subscription_id: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      paid_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('subscription_invoices', ['brand_id'], {
      name: 'idx_subscription_invoices_brand_id',
    });
    await queryInterface.addIndex('subscription_invoices', ['paypal_subscription_id'], {
      name: 'idx_subscription_invoices_paypal_subscription_id',
    });

    await queryInterface.createTable('subscription_payments', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'brand', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      invoice_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'subscription_invoices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'PHP',
      },
      status: {
        type: Sequelize.ENUM('pending', 'succeeded', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      payment_method: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'paypal',
      },
      paypal_transaction_id: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      paypal_subscription_id: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      failure_reason: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('subscription_payments', ['brand_id'], {
      name: 'idx_subscription_payments_brand_id',
    });
    await queryInterface.addIndex('subscription_payments', ['invoice_id'], {
      name: 'idx_subscription_payments_invoice_id',
    });
    await queryInterface.addIndex('subscription_payments', ['paypal_transaction_id'], {
      name: 'idx_subscription_payments_paypal_transaction_id',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('subscription_payments');
    // Drop ENUM types created for subscription_payments
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_subscription_payments_status";'
    );

    await queryInterface.dropTable('subscription_invoices');
    // Drop ENUM types created for subscription_invoices
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_subscription_invoices_status";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_subscription_invoices_billing_cycle";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_subscription_invoices_billing_reason";'
    );
  },
};
