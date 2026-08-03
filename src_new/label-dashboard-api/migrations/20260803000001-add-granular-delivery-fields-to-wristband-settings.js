'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('event_wristband_settings', 'delivery_address');
    await queryInterface.addColumn('event_wristband_settings', 'delivery_name',    { type: Sequelize.STRING(150), allowNull: true });
    await queryInterface.addColumn('event_wristband_settings', 'delivery_street',  { type: Sequelize.TEXT,        allowNull: true });
    await queryInterface.addColumn('event_wristband_settings', 'delivery_city',    { type: Sequelize.STRING(100), allowNull: true });
    await queryInterface.addColumn('event_wristband_settings', 'delivery_country', { type: Sequelize.STRING(100), allowNull: true });
    await queryInterface.addColumn('event_wristband_settings', 'delivery_zip',     { type: Sequelize.STRING(20),  allowNull: true });
    await queryInterface.addColumn('event_wristband_settings', 'delivery_phone',   { type: Sequelize.STRING(50),  allowNull: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('event_wristband_settings', 'delivery_name');
    await queryInterface.removeColumn('event_wristband_settings', 'delivery_street');
    await queryInterface.removeColumn('event_wristband_settings', 'delivery_city');
    await queryInterface.removeColumn('event_wristband_settings', 'delivery_country');
    await queryInterface.removeColumn('event_wristband_settings', 'delivery_zip');
    await queryInterface.removeColumn('event_wristband_settings', 'delivery_phone');
    await queryInterface.addColumn('event_wristband_settings', 'delivery_address', { type: Sequelize.TEXT, allowNull: true });
  }
};
