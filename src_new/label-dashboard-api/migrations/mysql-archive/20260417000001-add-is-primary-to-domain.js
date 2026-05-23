'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('domain', 'is_primary', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Set is_primary = true for spindly.app domains.
    // For brands with multiple spindly.app domains, only the first one
    // (alphabetically by domain_name) is marked primary to avoid duplicates.
    await queryInterface.sequelize.query(`
      UPDATE domain d1
      INNER JOIN (
        SELECT brand_id, MIN(domain_name) AS domain_name
        FROM domain
        WHERE domain_name LIKE '%.spindly.app'
        GROUP BY brand_id
      ) d2 ON d1.brand_id = d2.brand_id AND d1.domain_name = d2.domain_name
      SET d1.is_primary = TRUE
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('domain', 'is_primary');
  }
};
