'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Create songwriter table
    await queryInterface.createTable('songwriter', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      pro_affiliation: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Performance Rights Organization (e.g., ASCAP, BMI, SESAC)'
      },
      ipi_number: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Interested Party Information number'
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

    // Add unique constraint to prevent duplicate songwriters
    await queryInterface.addIndex('songwriter', ['name', 'pro_affiliation', 'ipi_number'], {
      unique: true,
      name: 'unique_songwriter'
    });

    // Step 2: Add songwriter_id columns to song_author and song_composer
    await queryInterface.addColumn('song_author', 'songwriter_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // Temporarily nullable for data migration
      references: {
        model: 'songwriter',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    await queryInterface.addColumn('song_composer', 'songwriter_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // Temporarily nullable for data migration
      references: {
        model: 'songwriter',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    // Step 3: Migrate data from song_author to songwriter table
    // Get all unique authors
    const [authors] = await queryInterface.sequelize.query(`
      SELECT DISTINCT name, pro_affiliation, ipi_number
      FROM song_author
      WHERE name IS NOT NULL
    `);

    // Insert unique authors into songwriter table
    for (const author of authors) {
      await queryInterface.sequelize.query(`
        INSERT INTO songwriter (name, pro_affiliation, ipi_number, createdAt, updatedAt)
        VALUES (:name, :pro_affiliation, :ipi_number, NOW(), NOW())
        ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
      `, {
        replacements: {
          name: author.name,
          pro_affiliation: author.pro_affiliation,
          ipi_number: author.ipi_number
        }
      });
    }

    // Step 4: Migrate data from song_composer to songwriter table
    // Get all unique composers
    const [composers] = await queryInterface.sequelize.query(`
      SELECT DISTINCT name, pro_affiliation, ipi_number
      FROM song_composer
      WHERE name IS NOT NULL
    `);

    // Insert unique composers into songwriter table
    for (const composer of composers) {
      await queryInterface.sequelize.query(`
        INSERT INTO songwriter (name, pro_affiliation, ipi_number, createdAt, updatedAt)
        VALUES (:name, :pro_affiliation, :ipi_number, NOW(), NOW())
        ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
      `, {
        replacements: {
          name: composer.name,
          pro_affiliation: composer.pro_affiliation,
          ipi_number: composer.ipi_number
        }
      });
    }

    // Step 5: Update song_author records with songwriter_id
    await queryInterface.sequelize.query(`
      UPDATE song_author sa
      INNER JOIN songwriter s ON
        sa.name = s.name AND
        (sa.pro_affiliation = s.pro_affiliation OR (sa.pro_affiliation IS NULL AND s.pro_affiliation IS NULL)) AND
        (sa.ipi_number = s.ipi_number OR (sa.ipi_number IS NULL AND s.ipi_number IS NULL))
      SET sa.songwriter_id = s.id
    `);

    // Step 6: Update song_composer records with songwriter_id
    await queryInterface.sequelize.query(`
      UPDATE song_composer sc
      INNER JOIN songwriter s ON
        sc.name = s.name AND
        (sc.pro_affiliation = s.pro_affiliation OR (sc.pro_affiliation IS NULL AND s.pro_affiliation IS NULL)) AND
        (sc.ipi_number = s.ipi_number OR (sc.ipi_number IS NULL AND s.ipi_number IS NULL))
      SET sc.songwriter_id = s.id
    `);

    // Step 7: Make songwriter_id NOT NULL
    await queryInterface.changeColumn('song_author', 'songwriter_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'songwriter',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    await queryInterface.changeColumn('song_composer', 'songwriter_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'songwriter',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    // Step 8: Remove redundant columns from song_author
    await queryInterface.removeColumn('song_author', 'name');
    await queryInterface.removeColumn('song_author', 'pro_affiliation');
    await queryInterface.removeColumn('song_author', 'ipi_number');

    // Step 9: Remove redundant columns from song_composer
    await queryInterface.removeColumn('song_composer', 'name');
    await queryInterface.removeColumn('song_composer', 'pro_affiliation');
    await queryInterface.removeColumn('song_composer', 'ipi_number');
  },

  async down(queryInterface, Sequelize) {
    // Step 1: Add back the columns to song_author
    await queryInterface.addColumn('song_author', 'name', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('song_author', 'pro_affiliation', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('song_author', 'ipi_number', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });

    // Step 2: Add back the columns to song_composer
    await queryInterface.addColumn('song_composer', 'name', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('song_composer', 'pro_affiliation', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('song_composer', 'ipi_number', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });

    // Step 3: Restore data to song_author from songwriter table
    await queryInterface.sequelize.query(`
      UPDATE song_author sa
      INNER JOIN songwriter s ON sa.songwriter_id = s.id
      SET sa.name = s.name,
          sa.pro_affiliation = s.pro_affiliation,
          sa.ipi_number = s.ipi_number
    `);

    // Step 4: Restore data to song_composer from songwriter table
    await queryInterface.sequelize.query(`
      UPDATE song_composer sc
      INNER JOIN songwriter s ON sc.songwriter_id = s.id
      SET sc.name = s.name,
          sc.pro_affiliation = s.pro_affiliation,
          sc.ipi_number = s.ipi_number
    `);

    // Step 5: Make name NOT NULL again
    await queryInterface.changeColumn('song_author', 'name', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });
    await queryInterface.changeColumn('song_composer', 'name', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });

    // Step 6: Remove songwriter_id columns
    await queryInterface.removeColumn('song_author', 'songwriter_id');
    await queryInterface.removeColumn('song_composer', 'songwriter_id');

    // Step 7: Drop unique index from songwriter
    await queryInterface.removeIndex('songwriter', 'unique_songwriter');

    // Step 8: Drop songwriter table
    await queryInterface.dropTable('songwriter');
  }
};
