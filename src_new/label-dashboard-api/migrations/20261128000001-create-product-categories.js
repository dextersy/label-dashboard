'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create product_category table
    await queryInterface.createTable('product_category', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'brand', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      color: {
        type: Sequelize.STRING(16),
        allowNull: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_visible: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      woocommerce_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      shopify_id: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      loyverse_id: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('product_category', ['brand_id']);
    await queryInterface.addIndex('product_category', ['brand_id', 'slug'], {
      unique: true,
      where: { slug: { [Sequelize.Op.ne]: null } },
      name: 'product_category_brand_slug_unique',
    });

    // Create product_product_category junction table
    await queryInterface.createTable('product_product_category', {
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'product', key: 'id' },
        onDelete: 'CASCADE',
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'product_category', key: 'id' },
        onDelete: 'CASCADE',
      },
    });

    await queryInterface.addIndex('product_product_category', ['product_id']);
    await queryInterface.addIndex('product_product_category', ['category_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('product_product_category');
    await queryInterface.dropTable('product_category');
  },
};
