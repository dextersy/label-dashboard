
'use strict';

/**
 * Resilient Sequelize migration for PostgreSQL.
 * Skips existing objects and continues after individual failures.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;

    // Execute an operation without stopping the migration.
    async function safe(label, operation) {
      try {
        await operation();
        console.log(`[SUCCESS] ${label}`);
      } catch (error) {
        console.error(`[FAILED] ${label}: ${error.message}`);
      }
    }

    // Check whether a table exists.
    async function tableExists(table) {
      const [results] = await sequelize.query(`
        SELECT to_regclass('public."${table}"') AS exists;
      `);
      return results[0].exists !== null;
    }

    // Check whether a column exists.
    async function columnExists(table, column) {
      const [results] = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = '${table}'
          AND column_name = '${column}'
        ) AS exists;
      `);
      return results[0].exists;
    }

    // Check whether an index exists.
    async function indexExists(indexName) {
      const [results] = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
          AND indexname = '${indexName}'
        ) AS exists;
      `);
      return results[0].exists;
    }

    // Create a table only if it doesn't exist.
    async function safeCreateTable(table, columns) {
      await safe(`Create table ${table}`, async () => {
        if (await tableExists(table)) {
          console.log(`[SKIP] Table ${table} already exists`);
          return;
        }
        await queryInterface.createTable(table, columns);
      });
    }

    // Add a column only if it doesn't exist.
    async function safeAddColumn(table, column, definition) {
      await safe(`Add column ${table}.${column}`, async () => {
        if (await columnExists(table, column)) {
          console.log(`[SKIP] Column ${table}.${column} already exists`);
          return;
        }
        await queryInterface.addColumn(table, column, definition);
      });
    }

    // Add an index only if it doesn't exist.
    async function safeAddIndex(table, fields, options = {}) {
      const name = options.name;
      await safe(`Add index ${name || fields.join('_')}`, async () => {
        if (name && await indexExists(name)) {
          console.log(`[SKIP] Index ${name} already exists`);
          return;
        }
        await queryInterface.addIndex(table, fields, options);
      });
    }

    // 1. Create product table
    await safeCreateTable('product', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      sku: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'brand', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      release_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'release', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      artist_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'artist', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
    });

    await safeAddIndex('product', ['brand_id'], {
      name: 'idx_product_brand_id',
    });

    await safeAddIndex('product', ['brand_id', 'status'], {
      name: 'idx_product_brand_status',
    });

    await safeAddIndex('product', ['release_id'], {
      name: 'idx_product_release_id',
    });

    await safeAddIndex('product', ['artist_id'], {
      name: 'idx_product_artist_id',
    });

    await safeAddIndex('product', ['brand_id', 'sku'], {
      unique: true,
      where: { sku: { [Sequelize.Op.ne]: null } },
      name: 'product_brand_sku_unique',
    });

    // 2. Create product_image table
    await safeCreateTable('product_image', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'product', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      path: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    });

    await safeAddIndex('product_image', ['product_id'], {
      name: 'idx_product_image_product_id',
    });

    // 3. Create product_artist table
    await safeCreateTable('product_artist', {
      artist_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'artist', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'product', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      merch_royalty_percentage: {
        type: Sequelize.DECIMAL(4, 3),
        allowNull: false,
        defaultValue: 0.500,
      },
      merch_royalty_type: {
        type: Sequelize.ENUM('Revenue', 'Profit'),
        allowNull: false,
        defaultValue: 'Revenue',
      },
    });

    // 4. Add product_id to financial tables
    await safeAddColumn('earning', 'product_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'product', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await safeAddIndex('earning', ['product_id'], {
      name: 'idx_earning_product_id',
    });

    await safeAddColumn('royalty', 'product_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'product', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await safeAddIndex('royalty', ['product_id'], {
      name: 'idx_royalty_product_id',
    });

    await safeAddColumn('recuperable_expense', 'product_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'product', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await safeAddIndex('recuperable_expense', ['product_id'], {
      name: 'idx_recuperable_expense_product_id',
    });

    // 5. Make release_id nullable
    for (const table of ['earning', 'recuperable_expense']) {
      await safe(table + '.release_id nullable', async () => {
        await queryInterface.changeColumn(table, 'release_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
        });
      });
    }

    // 6. Add Merch to enum_earning_type
    await safe('Add Merch enum value', async () => {
      await sequelize.query(`
        ALTER TYPE "enum_earning_type"
        ADD VALUE IF NOT EXISTS 'Merch';
      `);
    });

    // 7. Add merch royalty columns to release_artist
    await safeAddColumn(
      'release_artist',
      'merch_royalty_percentage',
      {
        type: Sequelize.DECIMAL(4, 3),
        allowNull: false,
        defaultValue: 0.200,
      }
    );

    await safeAddColumn(
      'release_artist',
      'merch_royalty_type',
      {
        type: Sequelize.ENUM('Revenue', 'Profit'),
        allowNull: false,
        defaultValue: 'Revenue',
      }
    );

    // 8. Add merch fee columns and workspace feature to brand
    await safeAddColumn('brand', 'merch_transaction_fixed_fee', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });

    await safeAddColumn('brand', 'merch_revenue_percentage_fee', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
    });

    await safeAddColumn('brand', 'merch_fee_revenue_type', {
      type: Sequelize.ENUM('net', 'gross'),
      allowNull: true,
    });

    await safeAddColumn('brand', 'feature_merch_workspace', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // 9. Backfill merch royalty columns
    await safe('Backfill release_artist merch royalties', async () => {
      await sequelize.query(`
        UPDATE release_artist
        SET merch_royalty_percentage = physical_royalty_percentage,
            merch_royalty_type =
              physical_royalty_type::text::enum_release_artist_merch_royalty_type
        WHERE merch_royalty_percentage = 0.200;
      `);
    });

    console.log('Migration execution finished. Review FAILED messages above.');
  },
  
  async down(queryInterface, Sequelize) {
    // Remove brand columns
    await queryInterface.removeColumn('brand', 'feature_merch_workspace');
    await queryInterface.removeColumn('brand', 'merch_fee_revenue_type');
    await queryInterface.removeColumn('brand', 'merch_revenue_percentage_fee');
    await queryInterface.removeColumn('brand', 'merch_transaction_fixed_fee');

    // Remove release_artist columns
    await queryInterface.removeColumn('release_artist', 'merch_royalty_type');
    await queryInterface.removeColumn('release_artist', 'merch_royalty_percentage');

    // Note: Cannot remove enum value 'Merch' from PostgreSQL easily

    // Restore NOT NULL on release_id columns
    await queryInterface.changeColumn('recuperable_expense', 'release_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
    await queryInterface.changeColumn('earning', 'release_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    // Remove product_id from financial tables
    await queryInterface.removeColumn('recuperable_expense', 'product_id');
    await queryInterface.removeColumn('royalty', 'product_id');
    await queryInterface.removeColumn('earning', 'product_id');

    // Drop tables in reverse order
    await queryInterface.dropTable('product_artist');
    await queryInterface.dropTable('product_image');
    await queryInterface.dropTable('product');
  }
};
