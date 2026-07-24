'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('press_campaign', 'campaign_type', {
      type: Sequelize.ENUM('release', 'event'),
      allowNull: false,
      defaultValue: 'release',
      after: 'artist_id'
    });

    await queryInterface.addColumn('press_campaign', 'event_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'event',
        key: 'id'
      },
      onUpdate: 'NO ACTION',
      onDelete: 'SET NULL',
      after: 'campaign_type'
    });

    await queryInterface.addIndex('press_campaign', ['event_id'], {
      name: 'idx_press_campaign_event_id'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('press_campaign', 'idx_press_campaign_event_id');
    await queryInterface.removeColumn('press_campaign', 'event_id');
    await queryInterface.removeColumn('press_campaign', 'campaign_type');
  }
};
