'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('song', 'ai_summary', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('song', 'ai_summary');
  },
};
