'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('press_campaign_link', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      campaign_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'press_campaign', key: 'id' },
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      },
      label: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      url: {
        type: Sequelize.STRING(1024),
        allowNull: false,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('press_campaign_link');
  },
};
