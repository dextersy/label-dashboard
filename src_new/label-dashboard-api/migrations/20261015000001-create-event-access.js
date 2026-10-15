'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('event_access', {
      event_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'event', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      invite_email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('viewer', 'manager'),
        allowNull: false,
        defaultValue: 'viewer',
      },
      status: {
        type: Sequelize.ENUM('Pending', 'Invited', 'Accepted'),
        allowNull: false,
        defaultValue: 'Invited',
      },
      invite_hash: {
        type: Sequelize.STRING(255),
        allowNull: true,
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

    await queryInterface.addIndex('event_access', ['user_id'], { name: 'idx_event_access_user_id' });
    await queryInterface.addIndex('event_access', ['invite_hash'], { name: 'idx_event_access_invite_hash', unique: true, where: { invite_hash: { [Sequelize.Op.ne]: null } } });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('event_access');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_event_access_role"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_event_access_status"');
  },
};
