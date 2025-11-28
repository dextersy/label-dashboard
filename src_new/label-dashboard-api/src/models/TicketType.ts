import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface TicketTypeAttributes {
  id: number;
  event_id: number;
  name: string;
  price: number;
  max_tickets: number;
  start_date?: Date | null;
  end_date?: Date | null;
  disabled?: boolean;
}

interface TicketTypeCreationAttributes extends Optional<TicketTypeAttributes, 'id'> {}

class TicketType extends Model<TicketTypeAttributes, TicketTypeCreationAttributes> implements TicketTypeAttributes {
  public id!: number;
  public event_id!: number;
  public name!: string;
  public price!: number;
  public max_tickets!: number;
  public start_date?: Date | null;
  public end_date?: Date | null;
  public disabled?: boolean;

  // Association properties
  public event?: any;
  public tickets?: any[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Helper methods
  public isAvailable(): boolean {
    const now = new Date();

    // Check if within date range
    if (this.start_date && now < this.start_date) {
      return false;
    }

    if (this.end_date && now > this.end_date) {
      return false;
    }

    return true;
  }

  public async isSoldOut(): Promise<boolean> {
    // 0 means unlimited tickets
    if (this.max_tickets === 0) {
      return false;
    }

    // Count sold tickets for this type
    const soldCount = await this.getSoldCount();
    return soldCount >= this.max_tickets;
  }

  public async getRemainingTickets(): Promise<number | null> {
    // 0 means unlimited tickets
    if (this.max_tickets === 0) {
      return null; // null indicates unlimited
    }

    const soldCount = await this.getSoldCount();
    return Math.max(0, this.max_tickets - soldCount);
  }

  public async getSoldCount(): Promise<number> {
    const { Ticket } = require('./');
    const { Op } = require('sequelize');

    // Only count confirmed/paid tickets, not pending ones
    const result = await Ticket.sum('number_of_entries', {
      where: {
        ticket_type_id: this.id,
        status: {
          [Op.in]: ['Payment Confirmed', 'Ticket sent.']
        }
      }
    });

    return result || 0;
  }
}

TicketType.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        // Force conversion to number when reading from database
        const value = this.getDataValue('price');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
      set(value: any) {
        // Force conversion to number when writing to database
        this.setDataValue('price', value !== null && value !== undefined ? parseFloat(value) : value);
      }
    },
    max_tickets: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isAfterStartDate(value: Date | null) {
          if (value && this.start_date && value <= this.start_date) {
            throw new Error('End date must be after start date');
          }
        }
      }
    },
    disabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'ticket_type',
    timestamps: true,
  }
);

export default TicketType;