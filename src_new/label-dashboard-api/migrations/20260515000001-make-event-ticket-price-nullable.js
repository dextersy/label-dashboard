'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('event', 'ticket_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface, Sequelize) {
    // First set any nulls to 0 to avoid constraint violation on rollback
    await queryInterface.sequelize.query(
      'UPDATE event SET ticket_price = 0 WHERE ticket_price IS NULL'
    );
    await queryInterface.changeColumn('event', 'ticket_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    });
  }
};
