'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ticket_type table
    await queryInterface.createTable('ticket_type', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      event_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'event',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
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

    // Add ticket_type_id column to ticket table
    await queryInterface.addColumn('ticket', 'ticket_type_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // Initially nullable for existing tickets
      references: {
        model: 'ticket_type',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Create default ticket types for existing events
    const events = await queryInterface.sequelize.query(
      'SELECT id, ticket_price, ticket_naming FROM event',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const event of events) {
      const [ticketType] = await queryInterface.sequelize.query(
        'INSERT INTO ticket_type (event_id, name, price, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())',
        {
          replacements: [event.id, event.ticket_naming || 'Regular', event.ticket_price],
          type: queryInterface.sequelize.QueryTypes.INSERT
        }
      );

      // Update existing tickets for this event to reference the new ticket type
      await queryInterface.sequelize.query(
        'UPDATE ticket SET ticket_type_id = ? WHERE event_id = ?',
        {
          replacements: [ticketType, event.id],
          type: queryInterface.sequelize.QueryTypes.UPDATE
        }
      );
    }

    // Make ticket_type_id not nullable after backfill
    await queryInterface.changeColumn('ticket', 'ticket_type_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'ticket_type',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove ticket_type_id column from ticket table
    await queryInterface.removeColumn('ticket', 'ticket_type_id');

    // Drop ticket_type table
    await queryInterface.dropTable('ticket_type');
  }
};