'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('event_brand_collaborations', {
      event_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'event', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'brand', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role: {
        type: Sequelize.ENUM('viewer', 'manager'),
        allowNull: false,
        defaultValue: 'viewer',
      },
      status: {
        type: Sequelize.ENUM('Pending', 'Accepted'),
        allowNull: false,
        defaultValue: 'Pending',
      },
      invite_hash: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.sequelize.query(
      'ALTER TABLE event_brand_collaborations ADD PRIMARY KEY (event_id, brand_id)'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('event_brand_collaborations');
  },
};
