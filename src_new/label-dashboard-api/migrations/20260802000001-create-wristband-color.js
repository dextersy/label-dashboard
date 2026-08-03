'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wristband_color', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      label: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      image_path: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      bg_color: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      available_quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total stock available for ordering'
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Seed initial colors (matching the hardcoded values in the frontend component)
    await queryInterface.bulkInsert('wristband_color', [
      { slug: 'pink',   label: 'Pink',   image_path: 'assets/img/wristband-pink.jpg',   bg_color: '#F535B2', sort_order: 1, created_at: new Date(), updated_at: new Date() },
      { slug: 'blue',   label: 'Blue',   image_path: 'assets/img/wristband-blue.jpg',   bg_color: '#2B8FE8', sort_order: 2, created_at: new Date(), updated_at: new Date() },
      { slug: 'green',  label: 'Green',  image_path: 'assets/img/wristband-green.jpg',  bg_color: '#66DE1A', sort_order: 3, created_at: new Date(), updated_at: new Date() },
      { slug: 'yellow', label: 'Yellow', image_path: 'assets/img/wristband-yellow.jpg', bg_color: '#FFE800', sort_order: 4, created_at: new Date(), updated_at: new Date() },
      { slug: 'orange', label: 'Orange', image_path: 'assets/img/wristband-orange.jpg', bg_color: '#F57C28', sort_order: 5, created_at: new Date(), updated_at: new Date() }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wristband_color');
  }
};
