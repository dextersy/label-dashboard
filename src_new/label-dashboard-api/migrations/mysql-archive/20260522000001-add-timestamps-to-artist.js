'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('artist');

    if (!tableInfo.createdAt) {
      await queryInterface.addColumn('artist', 'createdAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }

    if (!tableInfo.updatedAt) {
      await queryInterface.addColumn('artist', 'updatedAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('artist');

    if (tableInfo.updatedAt) {
      await queryInterface.removeColumn('artist', 'updatedAt');
    }

    if (tableInfo.createdAt) {
      await queryInterface.removeColumn('artist', 'createdAt');
    }
  }
};
