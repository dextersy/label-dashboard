'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove any duplicate plan names before adding the constraint, keeping the
    // lowest-id row for each name (the original seeded row).
    await queryInterface.sequelize.query(`
      DELETE FROM plan
      WHERE id NOT IN (
        SELECT DISTINCT ON (name) id
        FROM plan
        ORDER BY name, id ASC
      )
    `);

    await queryInterface.addConstraint('plan', {
      fields: ['name'],
      type: 'unique',
      name: 'uq_plan_name',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('plan', 'uq_plan_name');
  },
};
