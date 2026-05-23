'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('walk_in_transaction_item', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      walk_in_transaction_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'walk_in_transaction',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      walk_in_type_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'walk_in_type',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      price_per_unit: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
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
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('walk_in_transaction_item');
  }
};
