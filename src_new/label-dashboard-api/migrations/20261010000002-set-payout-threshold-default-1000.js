'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('brand', 'payout_threshold', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 1000,
    });

    await queryInterface.sequelize.query(
      `UPDATE brand SET payout_threshold = 1000 WHERE payout_threshold IS NULL`
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('brand', 'payout_threshold', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.sequelize.query(
      `UPDATE brand SET payout_threshold = NULL WHERE payout_threshold = 1000`
    );
  }
};
