'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('saved_delivery_address', 'address');
    await queryInterface.addColumn('saved_delivery_address', 'name',    { type: Sequelize.STRING(150), allowNull: true });
    await queryInterface.addColumn('saved_delivery_address', 'street',  { type: Sequelize.TEXT,        allowNull: true });
    await queryInterface.addColumn('saved_delivery_address', 'city',    { type: Sequelize.STRING(100), allowNull: true });
    await queryInterface.addColumn('saved_delivery_address', 'country', { type: Sequelize.STRING(100), allowNull: true });
    await queryInterface.addColumn('saved_delivery_address', 'zip',     { type: Sequelize.STRING(20),  allowNull: true });
    await queryInterface.addColumn('saved_delivery_address', 'phone',   { type: Sequelize.STRING(50),  allowNull: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('saved_delivery_address', 'name');
    await queryInterface.removeColumn('saved_delivery_address', 'street');
    await queryInterface.removeColumn('saved_delivery_address', 'city');
    await queryInterface.removeColumn('saved_delivery_address', 'country');
    await queryInterface.removeColumn('saved_delivery_address', 'zip');
    await queryInterface.removeColumn('saved_delivery_address', 'phone');
    await queryInterface.addColumn('saved_delivery_address', 'address', { type: Sequelize.TEXT, allowNull: false, defaultValue: '' });
  }
};
