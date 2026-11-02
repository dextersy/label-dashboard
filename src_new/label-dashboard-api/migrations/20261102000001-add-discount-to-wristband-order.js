'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('wristband_order', 'discount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      after: 'shipping_fee',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('wristband_order', 'discount');
  },
};
