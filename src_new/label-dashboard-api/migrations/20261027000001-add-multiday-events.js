'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create event_day table
    await queryInterface.createTable('event_day', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      event_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'event', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      date_and_time: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(100),
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

    await queryInterface.addIndex('event_day', ['event_id'], { name: 'idx_event_day_event_id' });

    // 2. Create ticket_type_day join table
    await queryInterface.createTable('ticket_type_day', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      ticket_type_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ticket_type', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      event_day_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'event_day', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    });

    await queryInterface.addIndex('ticket_type_day', ['ticket_type_id', 'event_day_id'], {
      name: 'idx_ticket_type_day_unique',
      unique: true,
    });

    // 3. Create ticket_scan_log table
    await queryInterface.createTable('ticket_scan_log', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      ticket_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ticket', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      event_day_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'event_day', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      entries_claimed: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      scanned_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('ticket_scan_log', ['ticket_id', 'event_day_id'], {
      name: 'idx_ticket_scan_log_ticket_day',
    });

    // 4. Backfill: create one EventDay per existing event from event.date_and_time
    await queryInterface.sequelize.query(`
      INSERT INTO event_day (event_id, date_and_time, label, created_at, updated_at)
      SELECT id, date_and_time, NULL, NOW(), NOW()
      FROM event
    `);

    // 5. Backfill: link every existing ticket type to its event's single EventDay
    await queryInterface.sequelize.query(`
      INSERT INTO ticket_type_day (ticket_type_id, event_day_id)
      SELECT tt.id, ed.id
      FROM ticket_type tt
      JOIN event_day ed ON ed.event_id = tt.event_id
    `);

    // 6. Backfill: migrate existing number_of_claimed_entries into ticket_scan_log
    //    One log row per ticket that has been partially or fully scanned in
    await queryInterface.sequelize.query(`
      INSERT INTO ticket_scan_log (ticket_id, event_day_id, entries_claimed, scanned_at)
      SELECT t.id, ed.id, t.number_of_claimed_entries, NOW()
      FROM ticket t
      JOIN event_day ed ON ed.event_id = t.event_id
      WHERE t.number_of_claimed_entries > 0
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ticket_scan_log');
    await queryInterface.dropTable('ticket_type_day');
    await queryInterface.dropTable('event_day');
  },
};
