'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE plan SET price_monthly = 149, price_annual = 1490, "updatedAt" = NOW() WHERE name = 'Starter';
      UPDATE plan SET price_monthly = 349, price_annual = 3490, "updatedAt" = NOW() WHERE name = 'Pro';
      UPDATE plan SET price_monthly = 599, price_annual = 5990, "updatedAt" = NOW() WHERE name = 'Unlimited';
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE plan SET price_monthly = 99,  price_annual = 990,  "updatedAt" = NOW() WHERE name = 'Starter';
      UPDATE plan SET price_monthly = 249, price_annual = 2490, "updatedAt" = NOW() WHERE name = 'Pro';
      UPDATE plan SET price_monthly = 499, price_annual = 4990, "updatedAt" = NOW() WHERE name = 'Unlimited';
    `);
  },
};
