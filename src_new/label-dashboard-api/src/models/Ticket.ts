import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

type TicketStatus = 'New' | 'Payment Confirmed' | 'Ticket sent.' | 'Canceled';

interface TicketAttributes {
  id: number;
  event_id: number;
  name: string;
  email_address: string;
  contact_number?: string;
  number_of_entries: number;
  number_of_claimed_entries: number;
  ticket_code: string;
  status: TicketStatus;
  payment_link?: string;
  payment_link_id?: string;
  checkout_key?: string;
  price_per_ticket?: number;
  payment_processing_fee?: number;
  referrer_id?: number;
  order_timestamp: Date;
}

interface TicketCreationAttributes extends Optional<TicketAttributes, 'id' | 'number_of_entries' | 'number_of_claimed_entries' | 'status' | 'order_timestamp'> {}

class Ticket extends Model<TicketAttributes, TicketCreationAttributes> implements TicketAttributes {
  public id!: number;
  public event_id!: number;
  public name!: string;
  public email_address!: string;
  public contact_number?: string;
  public number_of_entries!: number;
  public number_of_claimed_entries!: number;
  public ticket_code!: string;
  public status!: TicketStatus;
  public payment_link?: string;
  public payment_link_id?: string;
  public checkout_key?: string;
  public price_per_ticket?: number;
  public payment_processing_fee?: number;
  public referrer_id?: number;
  public order_timestamp!: Date;

  // Association properties
  public event?: any;
  public referrer?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Ticket.init(
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
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    contact_number: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    number_of_entries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      get() {
        // Force conversion to number when reading from database
        const value = this.getDataValue('number_of_entries');
        return typeof value === 'string' ? parseInt(value, 10) : value;
      },
      set(value: any) {
        // Force conversion to number when writing to database
        this.setDataValue('number_of_entries', typeof value === 'string' ? parseInt(value, 10) : value);
      }
    },
    ticket_code: {
      type: DataTypes.STRING(5),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('New', 'Payment Confirmed', 'Ticket sent.', 'Canceled'),
      allowNull: false,
      defaultValue: 'New',
    },
    payment_link: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    payment_link_id: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    checkout_key: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    price_per_ticket: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        // Force conversion to number when reading from database
        const value = this.getDataValue('price_per_ticket');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
      set(value: any) {
        // Force conversion to number when writing to database
        this.setDataValue('price_per_ticket', value !== null && value !== undefined ? parseFloat(value) : value);
      }
    },
    payment_processing_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        // Force conversion to number when reading from database
        const value = this.getDataValue('payment_processing_fee');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
      set(value: any) {
        // Force conversion to number when writing to database
        this.setDataValue('payment_processing_fee', value !== null && value !== undefined ? parseFloat(value) : value);
      }
    },
    referrer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    number_of_claimed_entries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      get() {
        // Force conversion to number when reading from database
        const value = this.getDataValue('number_of_claimed_entries');
        return typeof value === 'string' ? parseInt(value, 10) : value;
      },
      set(value: any) {
        // Force conversion to number when writing to database
        this.setDataValue('number_of_claimed_entries', typeof value === 'string' ? parseInt(value, 10) : value);
      }
    },
    order_timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'ticket',
    timestamps: false,
  }
);

export default Ticket;