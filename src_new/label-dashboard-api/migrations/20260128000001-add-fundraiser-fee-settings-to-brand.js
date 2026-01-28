'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('brand');

    // Fundraiser Fee Settings

    if (!tableInfo.fundraiser_transaction_fixed_fee) {
      await queryInterface.addColumn('brand', 'fundraiser_transaction_fixed_fee', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Fixed fee per fundraiser donation transaction charged to sublabel'
      });
    }

    if (!tableInfo.fundraiser_revenue_percentage_fee) {
      await queryInterface.addColumn('brand', 'fundraiser_revenue_percentage_fee', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Percentage of fundraiser revenue charged to sublabel (0-100)'
      });
    }

    if (!tableInfo.fundraiser_fee_revenue_type) {
      await queryInterface.addColumn('brand', 'fundraiser_fee_revenue_type', {
        type: Sequelize.ENUM('net', 'gross'),
        allowNull: true,
        defaultValue: 'net',
        comment: 'Whether fundraiser percentage fee applies to net or gross revenue'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('brand');

    // Remove fundraiser fee columns if they exist

    if (tableInfo.fundraiser_transaction_fixed_fee) {
      await queryInterface.removeColumn('brand', 'fundraiser_transaction_fixed_fee');
    }

    if (tableInfo.fundraiser_revenue_percentage_fee) {
      await queryInterface.removeColumn('brand', 'fundraiser_revenue_percentage_fee');
    }

    if (tableInfo.fundraiser_fee_revenue_type) {
      await queryInterface.removeColumn('brand', 'fundraiser_fee_revenue_type');
    }
  }
};
