'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audience_email_preference', {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      marketing_promos: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      event_recommendations: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      organizer_updates: {
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
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audience_email_preference');
  },
};
