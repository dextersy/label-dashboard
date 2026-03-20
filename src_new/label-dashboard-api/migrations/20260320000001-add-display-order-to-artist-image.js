'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('artist_image', 'display_order', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'exclude_from_epk'
    });

    // Backfill: assign display_order based on current date_uploaded DESC ordering per artist
    await queryInterface.sequelize.query(`
      UPDATE artist_image ai
      JOIN (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY artist_id ORDER BY date_uploaded DESC) AS rn
        FROM artist_image
      ) ranked ON ai.id = ranked.id
      SET ai.display_order = ranked.rn
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('artist_image', 'display_order');
  }
};
