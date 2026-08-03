'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('wristband_order', 'design_x', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn('wristband_order', 'design_y', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn('wristband_order', 'design_width', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn('wristband_order', 'design_height', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('wristband_order', 'design_x');
    await queryInterface.removeColumn('wristband_order', 'design_y');
    await queryInterface.removeColumn('wristband_order', 'design_width');
    await queryInterface.removeColumn('wristband_order', 'design_height');
  },
};
