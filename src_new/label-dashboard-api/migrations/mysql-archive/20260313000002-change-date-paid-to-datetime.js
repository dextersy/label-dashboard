'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('payment', 'date_paid', {
      type: Sequelize.DATE,
      allowNull: false,
    });
    await queryInterface.changeColumn('label_payment', 'date_paid', {
      type: Sequelize.DATE,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('payment', 'date_paid', {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });
    await queryInterface.changeColumn('label_payment', 'date_paid', {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });
  }
};
