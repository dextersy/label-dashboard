'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Change column default to true
    await queryInterface.changeColumn('brand', 'payout_on_event_close', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    // Backfill all existing rows
    await queryInterface.sequelize.query(
      `UPDATE brand SET payout_on_event_close = TRUE WHERE payout_on_event_close = FALSE`
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('brand', 'payout_on_event_close', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.sequelize.query(
      `UPDATE brand SET payout_on_event_close = FALSE`
    );
  }
};
