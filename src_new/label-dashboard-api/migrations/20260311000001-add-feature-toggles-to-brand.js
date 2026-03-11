'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('brand');

    if (!tableInfo.feature_music_workspace) {
      await queryInterface.addColumn('brand', 'feature_music_workspace', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the Music workspace is enabled for this brand'
      });
    }

    if (!tableInfo.feature_campaigns_workspace) {
      await queryInterface.addColumn('brand', 'feature_campaigns_workspace', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the Campaigns workspace is enabled for this brand'
      });
    }

    if (!tableInfo.feature_sublabels) {
      await queryInterface.addColumn('brand', 'feature_sublabels', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the Sublabels sidebar item is visible for this brand'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('brand');

    if (tableInfo.feature_music_workspace) {
      await queryInterface.removeColumn('brand', 'feature_music_workspace');
    }

    if (tableInfo.feature_campaigns_workspace) {
      await queryInterface.removeColumn('brand', 'feature_campaigns_workspace');
    }

    if (tableInfo.feature_sublabels) {
      await queryInterface.removeColumn('brand', 'feature_sublabels');
    }
  }
};
