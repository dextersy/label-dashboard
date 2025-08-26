'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create label_payment_method table
    await queryInterface.createTable('label_payment_method', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'brand',
          key: 'id'
        },
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.STRING(45),
        allowNull: false
      },
      account_name: {
        type: Sequelize.STRING(45),
        allowNull: false
      },
      account_number_or_email: {
        type: Sequelize.STRING(45),
        allowNull: false
      },
      is_default_for_brand: {
        type: Sequelize.TINYINT(1),
        allowNull: false,
        defaultValue: 0
      },
      bank_code: {
        type: Sequelize.STRING(45),
        allowNull: false,
        defaultValue: 'N/A'
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB'
    });

    // Create label_payment table
    await queryInterface.createTable('label_payment', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      description: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'brand',
          key: 'id'
        },
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE'
      },
      date_paid: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      paid_thru_type: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      paid_thru_account_name: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      paid_thru_account_number: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      payment_method_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'label_payment_method',
          key: 'id'
        },
        onUpdate: 'NO ACTION',
        onDelete: 'SET NULL'
      },
      reference_number: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      payment_processing_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB'
    });

    // Add indexes for better performance
    await queryInterface.addIndex('label_payment_method', ['brand_id'], {
      name: 'fk_label_payment_method_brand_idx'
    });

    await queryInterface.addIndex('label_payment_method', ['brand_id', 'is_default_for_brand'], {
      name: 'idx_label_payment_method_brand_default'
    });

    await queryInterface.addIndex('label_payment', ['brand_id'], {
      name: 'fk_label_payment_brand_idx'
    });

    await queryInterface.addIndex('label_payment', ['payment_method_id'], {
      name: 'fk_label_payment_method_idx'
    });

    await queryInterface.addIndex('label_payment', ['brand_id', 'date_paid'], {
      name: 'idx_label_payment_brand_date'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('label_payment', 'idx_label_payment_brand_date');
    await queryInterface.removeIndex('label_payment', 'fk_label_payment_method_idx');
    await queryInterface.removeIndex('label_payment', 'fk_label_payment_brand_idx');
    await queryInterface.removeIndex('label_payment_method', 'idx_label_payment_method_brand_default');
    await queryInterface.removeIndex('label_payment_method', 'fk_label_payment_method_brand_idx');

    // Drop tables (order matters due to foreign key constraints)
    await queryInterface.dropTable('label_payment');
    await queryInterface.dropTable('label_payment_method');
  }
};