'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove duplicate brand_plan rows, keeping only the most recently created one per brand
    await queryInterface.sequelize.query(`
      DELETE FROM brand_plan
      WHERE id NOT IN (
        SELECT DISTINCT ON (brand_id) id
        FROM brand_plan
        ORDER BY brand_id, "createdAt" DESC
      )
    `);

    await queryInterface.addConstraint('brand_plan', {
      fields: ['brand_id'],
      type: 'unique',
      name: 'uq_brand_plan_brand_id',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('brand_plan', 'uq_brand_plan_brand_id');
  },
};
