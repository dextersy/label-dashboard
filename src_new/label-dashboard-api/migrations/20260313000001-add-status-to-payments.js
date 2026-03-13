'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const paymentTableInfo = await queryInterface.describeTable('payment');
    const labelPaymentTableInfo = await queryInterface.describeTable('label_payment');

    if (!paymentTableInfo.status) {
      await queryInterface.addColumn('payment', 'status', {
        type: Sequelize.ENUM('pending', 'succeeded', 'failed'),
        allowNull: false,
        defaultValue: 'succeeded',
        comment: 'Transfer status: pending (initiated), succeeded (confirmed), failed (failed)'
      });
    }

    if (!paymentTableInfo.paymongo_transfer_id) {
      await queryInterface.addColumn('payment', 'paymongo_transfer_id', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Paymongo transfer ID (trsf_xxx) for webhook matching'
      });
    }

    if (!labelPaymentTableInfo.status) {
      await queryInterface.addColumn('label_payment', 'status', {
        type: Sequelize.ENUM('pending', 'succeeded', 'failed'),
        allowNull: false,
        defaultValue: 'succeeded',
        comment: 'Transfer status: pending (initiated), succeeded (confirmed), failed (failed)'
      });
    }

    if (!labelPaymentTableInfo.paymongo_transfer_id) {
      await queryInterface.addColumn('label_payment', 'paymongo_transfer_id', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Paymongo transfer ID (trsf_xxx) for webhook matching'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const paymentTableInfo = await queryInterface.describeTable('payment');
    const labelPaymentTableInfo = await queryInterface.describeTable('label_payment');

    if (paymentTableInfo.status) {
      await queryInterface.removeColumn('payment', 'status');
    }
    if (paymentTableInfo.paymongo_transfer_id) {
      await queryInterface.removeColumn('payment', 'paymongo_transfer_id');
    }
    if (labelPaymentTableInfo.status) {
      await queryInterface.removeColumn('label_payment', 'status');
    }
    if (labelPaymentTableInfo.paymongo_transfer_id) {
      await queryInterface.removeColumn('label_payment', 'paymongo_transfer_id');
    }
  }
};
