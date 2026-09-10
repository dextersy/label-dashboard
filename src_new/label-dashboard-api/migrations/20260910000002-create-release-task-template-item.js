'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('release_task_template_item', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      template_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'release_task_template', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      days_before_release: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('release_task_template_item', ['template_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('release_task_template_item');
  },
};
