'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notification', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id'
        },
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE'
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
        type: Sequelize.STRING(100),
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      link: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      is_read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB'
    });

    await queryInterface.addIndex('notification', ['user_id'], {
      name: 'idx_notification_user_id'
    });

    await queryInterface.addIndex('notification', ['brand_id'], {
      name: 'idx_notification_brand_id'
    });

    await queryInterface.addIndex('notification', ['is_read'], {
      name: 'idx_notification_is_read'
    });

    await queryInterface.addIndex('notification', ['created_at'], {
      name: 'idx_notification_created_at'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('notification');
  }
};
