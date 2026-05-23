'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('donation');

    if (!tableInfo.platform_fee) {
      await queryInterface.addColumn('donation', 'platform_fee', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
        comment: 'Platform fee charged on the donation (sublabel fee)'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('donation');

    if (tableInfo.platform_fee) {
      await queryInterface.removeColumn('donation', 'platform_fee');
    }
  }
};
