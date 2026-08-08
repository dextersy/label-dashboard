'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('event_like', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      audience_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'audience_user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      event_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'event', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('event_like', ['audience_user_id', 'event_id'], {
      unique: true,
      name: 'event_like_audience_user_id_event_id_unique',
    });

    await queryInterface.addIndex('event_like', ['event_id'], {
      name: 'event_like_event_id_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('event_like');
  },
};
