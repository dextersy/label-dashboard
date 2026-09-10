'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('brand_hidden_template', {
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
        onDelete: 'CASCADE',
      },
      template_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'release_task_template', key: 'id' },
        onDelete: 'CASCADE',
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

    await queryInterface.addIndex('brand_hidden_template', ['brand_id', 'template_id'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('brand_hidden_template');
  },
};
