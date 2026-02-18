'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add per-type royalty percentage and type columns to song_collaborator
    // Mirrors the fields on release_artist
    await queryInterface.addColumn('song_collaborator', 'streaming_royalty_percentage', {
      type: Sequelize.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0.500
    });
    await queryInterface.addColumn('song_collaborator', 'streaming_royalty_type', {
      type: Sequelize.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue'
    });

    await queryInterface.addColumn('song_collaborator', 'sync_royalty_percentage', {
      type: Sequelize.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0.500
    });
    await queryInterface.addColumn('song_collaborator', 'sync_royalty_type', {
      type: Sequelize.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue'
    });

    await queryInterface.addColumn('song_collaborator', 'download_royalty_percentage', {
      type: Sequelize.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0.500
    });
    await queryInterface.addColumn('song_collaborator', 'download_royalty_type', {
      type: Sequelize.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue'
    });

    await queryInterface.addColumn('song_collaborator', 'physical_royalty_percentage', {
      type: Sequelize.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0.200
    });
    await queryInterface.addColumn('song_collaborator', 'physical_royalty_type', {
      type: Sequelize.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('song_collaborator', 'streaming_royalty_percentage');
    await queryInterface.removeColumn('song_collaborator', 'streaming_royalty_type');
    await queryInterface.removeColumn('song_collaborator', 'sync_royalty_percentage');
    await queryInterface.removeColumn('song_collaborator', 'sync_royalty_type');
    await queryInterface.removeColumn('song_collaborator', 'download_royalty_percentage');
    await queryInterface.removeColumn('song_collaborator', 'download_royalty_type');
    await queryInterface.removeColumn('song_collaborator', 'physical_royalty_percentage');
    await queryInterface.removeColumn('song_collaborator', 'physical_royalty_type');
  }
};
