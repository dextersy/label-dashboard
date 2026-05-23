'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('event', 'event_type', {
      type: Sequelize.ENUM(
        'concert', 'festival', 'club_night', 'open_mic', 'dj_set',
        'listening_party', 'album_launch', 'workshop', 'meetup', 'other'
      ),
      allowNull: true,
      defaultValue: null,
      after: 'status'
    });
    await queryInterface.addColumn('event', 'ticketing_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'event_type'
    });
    await queryInterface.addColumn('event', 'external_ticket_link', {
      type: Sequelize.STRING(1024),
      allowNull: true,
      defaultValue: null,
      after: 'ticketing_enabled'
    });
    await queryInterface.addColumn('event', 'listed_on_ticketing', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'external_ticket_link'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('event', 'listed_on_ticketing');
    await queryInterface.removeColumn('event', 'external_ticket_link');
    await queryInterface.removeColumn('event', 'ticketing_enabled');
    await queryInterface.removeColumn('event', 'event_type');
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS `enum_event_event_type`");
  }
};
