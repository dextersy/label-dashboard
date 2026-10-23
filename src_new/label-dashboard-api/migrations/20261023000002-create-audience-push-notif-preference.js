'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audience_push_notif_preference', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      audience_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'audience_user', key: 'id' },
        onDelete: 'CASCADE',
      },
      connection_requests: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      new_events: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      points_rewards: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audience_push_notif_preference');
  },
};
