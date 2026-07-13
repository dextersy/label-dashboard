'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('brand', 'feature_artist_profiles', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'feature_sublabels'
    });
    await queryInterface.addColumn('brand', 'feature_music_releases', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'feature_artist_profiles'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('brand', 'feature_artist_profiles');
    await queryInterface.removeColumn('brand', 'feature_music_releases');
  }
};
