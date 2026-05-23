'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('event_tag', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      is_custom: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'brand', key: 'id' },
        onDelete: 'CASCADE'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Unique index for predefined tags (brand_id IS NULL)
    await queryInterface.addIndex('event_tag', {
      fields: ['name'],
      unique: true,
      name: 'event_tag_name_global_unique',
      where: { brand_id: null }
    });

    // Unique index for brand-scoped tags
    await queryInterface.addIndex('event_tag', {
      fields: ['name', 'brand_id'],
      unique: true,
      name: 'event_tag_name_brand_unique'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('event_tag');
  }
};
