'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('event_addon_payment', 'checkout_key', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'reference_number',
    });
    await queryInterface.addColumn('event_addon_payment', 'checkout_session_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'checkout_key',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('event_addon_payment', 'checkout_session_id');
    await queryInterface.removeColumn('event_addon_payment', 'checkout_key');
  },
};
