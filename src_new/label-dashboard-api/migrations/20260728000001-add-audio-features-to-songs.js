'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('song', 'audio_key', {
      type: Sequelize.STRING(10),
      allowNull: true,
    });
    await queryInterface.addColumn('song', 'audio_scale', {
      type: Sequelize.STRING(10),
      allowNull: true,
    });
    await queryInterface.addColumn('song', 'audio_key_strength', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn('song', 'audio_energy', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn('song', 'audio_danceability', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn('song', 'audio_dynamic_complexity', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn('song', 'audio_loudness', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn('song', 'audio_mood', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('song', 'audio_key');
    await queryInterface.removeColumn('song', 'audio_scale');
    await queryInterface.removeColumn('song', 'audio_key_strength');
    await queryInterface.removeColumn('song', 'audio_energy');
    await queryInterface.removeColumn('song', 'audio_danceability');
    await queryInterface.removeColumn('song', 'audio_dynamic_complexity');
    await queryInterface.removeColumn('song', 'audio_loudness');
    await queryInterface.removeColumn('song', 'audio_mood');
  },
};
