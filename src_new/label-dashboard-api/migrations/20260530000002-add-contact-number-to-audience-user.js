'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('audience_user', 'contact_number', {
      type: Sequelize.STRING(30),
      allowNull: true,
      after: 'last_name',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('audience_user', 'contact_number');
  },
};
