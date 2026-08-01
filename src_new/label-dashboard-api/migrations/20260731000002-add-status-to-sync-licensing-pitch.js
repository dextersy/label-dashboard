'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sync_licensing_pitch', 'status', {
      type: Sequelize.ENUM('Draft', 'Sent', 'Deleted'),
      allowNull: false,
      defaultValue: 'Draft',
      after: 'description',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('sync_licensing_pitch', 'status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_sync_licensing_pitch_status";');
  },
};
