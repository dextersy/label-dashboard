'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('plan', 'is_default_free', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Mark the existing Free plan (lowest id among free public plans)
    await queryInterface.sequelize.query(`
      UPDATE plan SET is_default_free = TRUE
      WHERE id = (
        SELECT id FROM plan
        WHERE name = 'Free' AND price_monthly = 0 AND price_annual = 0 AND is_public = TRUE
        ORDER BY id ASC
        LIMIT 1
      )
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('plan', 'is_default_free');
  },
};
