'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('event', 'member_discount_type', {
      type: Sequelize.ENUM('fixed', 'percent'),
      allowNull: true,
      defaultValue: null,
      after: 'walk_in_max_count',
    });
    await queryInterface.addColumn('event', 'member_discount_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      after: 'member_discount_type',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('event', 'member_discount_amount');
    await queryInterface.removeColumn('event', 'member_discount_type');
  },
};
