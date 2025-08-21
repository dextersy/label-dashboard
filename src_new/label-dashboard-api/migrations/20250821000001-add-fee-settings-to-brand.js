'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('brand');
    
    // General Monthly Fee (applies to both music and events)
    if (!tableInfo.monthly_fee) {
      await queryInterface.addColumn('brand', 'monthly_fee', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Monthly fee charged to sublabel (applies to both music and event earnings)'
      });
    }

    // Music Fee Settings

    if (!tableInfo.music_transaction_fixed_fee) {
      await queryInterface.addColumn('brand', 'music_transaction_fixed_fee', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Fixed fee per music transaction charged to sublabel'
      });
    }

    if (!tableInfo.music_revenue_percentage_fee) {
      await queryInterface.addColumn('brand', 'music_revenue_percentage_fee', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Percentage of music revenue charged to sublabel (0-100)'
      });
    }

    if (!tableInfo.music_fee_revenue_type) {
      await queryInterface.addColumn('brand', 'music_fee_revenue_type', {
        type: Sequelize.ENUM('net', 'gross'),
        allowNull: true,
        defaultValue: 'net',
        comment: 'Whether music percentage fee applies to net or gross revenue'
      });
    }

    // Event Fee Settings

    if (!tableInfo.event_transaction_fixed_fee) {
      await queryInterface.addColumn('brand', 'event_transaction_fixed_fee', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Fixed fee per event transaction charged to sublabel'
      });
    }

    if (!tableInfo.event_revenue_percentage_fee) {
      await queryInterface.addColumn('brand', 'event_revenue_percentage_fee', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Percentage of event revenue charged to sublabel (0-100)'
      });
    }

    if (!tableInfo.event_fee_revenue_type) {
      await queryInterface.addColumn('brand', 'event_fee_revenue_type', {
        type: Sequelize.ENUM('net', 'gross'),
        allowNull: true,
        defaultValue: 'net',
        comment: 'Whether event percentage fee applies to net or gross revenue'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('brand');
    
    // Remove general monthly fee column if it exists
    if (tableInfo.monthly_fee) {
      await queryInterface.removeColumn('brand', 'monthly_fee');
    }

    // Remove music fee columns if they exist
    
    if (tableInfo.music_transaction_fixed_fee) {
      await queryInterface.removeColumn('brand', 'music_transaction_fixed_fee');
    }
    
    if (tableInfo.music_revenue_percentage_fee) {
      await queryInterface.removeColumn('brand', 'music_revenue_percentage_fee');
    }
    
    if (tableInfo.music_fee_revenue_type) {
      await queryInterface.removeColumn('brand', 'music_fee_revenue_type');
    }

    // Remove event fee columns if they exist
    
    if (tableInfo.event_transaction_fixed_fee) {
      await queryInterface.removeColumn('brand', 'event_transaction_fixed_fee');
    }
    
    if (tableInfo.event_revenue_percentage_fee) {
      await queryInterface.removeColumn('brand', 'event_revenue_percentage_fee');
    }
    
    if (tableInfo.event_fee_revenue_type) {
      await queryInterface.removeColumn('brand', 'event_fee_revenue_type');
    }
  }
};