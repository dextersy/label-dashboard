'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('brand', 'payout_schedule', {
      type: Sequelize.ENUM('1st_and_16th', '1st_of_month', 'every_friday'),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addColumn('brand', 'payout_on_event_close', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('brand', 'payout_threshold', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('brand', 'payout_threshold');
    await queryInterface.removeColumn('brand', 'payout_on_event_close');
    await queryInterface.removeColumn('brand', 'payout_schedule');
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_brand_payout_schedule\";");
  }
};
