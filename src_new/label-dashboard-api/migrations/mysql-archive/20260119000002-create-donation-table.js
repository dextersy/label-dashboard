'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('donation', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      fundraiser_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'fundraiser',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      contact_number: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'paid', 'failed', 'refunded'),
        allowNull: false,
        defaultValue: 'pending',
      },
      processing_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      payment_reference: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      checkout_key: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      payment_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      anonymous: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      order_timestamp: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      date_paid: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB'
    });

    // Add index on checkout_key for webhook lookups
    await queryInterface.addIndex('donation', ['checkout_key'], {
      name: 'idx_donation_checkout_key'
    });

    // Add index on fundraiser_id for performance
    await queryInterface.addIndex('donation', ['fundraiser_id'], {
      name: 'fk_donation_fundraiser_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('donation');
  }
};
