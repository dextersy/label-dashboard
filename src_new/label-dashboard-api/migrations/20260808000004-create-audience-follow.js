'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audience_follow', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      audience_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'audience_user', key: 'id' },
        onDelete: 'CASCADE',
      },
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'brand', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('audience_follow', ['audience_user_id', 'brand_id'], {
      unique: true,
      name: 'audience_follow_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audience_follow');
  },
};
