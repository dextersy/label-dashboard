'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('artist', 'status', {
      type: Sequelize.ENUM('Active', 'Inactive'),
      allowNull: false,
      defaultValue: 'Active',
      after: 'epk_template'
    });

    await queryInterface.addColumn('artist', 'custom_data', {
      type: Sequelize.JSON,
      allowNull: true,
      after: 'status'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('artist', 'custom_data');
    await queryInterface.removeColumn('artist', 'status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_artist_status";').catch(() => {});
  }
};
