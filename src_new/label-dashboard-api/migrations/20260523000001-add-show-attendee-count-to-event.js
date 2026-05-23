'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('event', 'show_attendee_count', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'listed_on_ticketing',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('event', 'show_attendee_count');
  },
};
