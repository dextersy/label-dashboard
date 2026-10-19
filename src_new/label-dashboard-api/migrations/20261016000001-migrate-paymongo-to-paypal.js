'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // --- plan table ---
    // Rename paymongo_plan_id_monthly → paypal_plan_id_monthly
    await queryInterface.renameColumn('plan', 'paymongo_plan_id_monthly', 'paypal_plan_id_monthly');
    // Rename paymongo_plan_id_annual → paypal_plan_id_annual
    await queryInterface.renameColumn('plan', 'paymongo_plan_id_annual', 'paypal_plan_id_annual');

    // --- brand_plan table ---
    // Rename paymongo_subscription_id → paypal_subscription_id
    await queryInterface.renameColumn('brand_plan', 'paymongo_subscription_id', 'paypal_subscription_id');

    // Update the index on the subscription ID column (drop old, add new)
    try {
      await queryInterface.removeIndex('brand_plan', 'brand_plan_paymongo_subscription_id');
    } catch (_) {
      // Index may not exist under that name — ignore
    }
    await queryInterface.addIndex('brand_plan', ['paypal_subscription_id'], {
      name: 'brand_plan_paypal_subscription_id',
    });

    // Drop paymongo_customer_id (no longer needed — PayPal doesn't use a stored customer ID)
    await queryInterface.removeColumn('brand_plan', 'paymongo_customer_id');
  },

  async down(queryInterface, Sequelize) {
    // Restore paymongo_customer_id
    await queryInterface.addColumn('brand_plan', 'paymongo_customer_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    // Remove the paypal index before renaming
    try {
      await queryInterface.removeIndex('brand_plan', 'brand_plan_paypal_subscription_id');
    } catch (_) {}

    // Rename columns back first (column must exist before adding index)
    await queryInterface.renameColumn('brand_plan', 'paypal_subscription_id', 'paymongo_subscription_id');
    await queryInterface.renameColumn('plan', 'paypal_plan_id_monthly', 'paymongo_plan_id_monthly');
    await queryInterface.renameColumn('plan', 'paypal_plan_id_annual', 'paymongo_plan_id_annual');

    // Now add index on the restored column name
    await queryInterface.addIndex('brand_plan', ['paymongo_subscription_id'], {
      name: 'brand_plan_paymongo_subscription_id',
    });
  },
};
