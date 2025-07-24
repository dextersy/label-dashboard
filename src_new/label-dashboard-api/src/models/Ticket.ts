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
  ticket_code: string;
  status: TicketStatus;
  payment_link?: string;
  payment_link_id?: string;
  price_per_ticket?: number;
  payment_processing_fee?: number;
  referrer_id?: number;
}

interface TicketCreationAttributes extends Optional<TicketAttributes, 'id' | 'number_of_entries' | 'status'> {}

class Ticket extends Model<TicketAttributes, TicketCreationAttributes> implements TicketAttributes {
  public id!: number;
  public event_id!: number;
  public name!: string;
  public email_address!: string;
  public contact_number?: string;
  public number_of_entries!: number;
  public ticket_code!: string;
  public status!: TicketStatus;
  public payment_link?: string;
  public payment_link_id?: string;
  public price_per_ticket?: number;
  public payment_processing_fee?: number;
  public referrer_id?: number;

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
    price_per_ticket: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    payment_processing_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    referrer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'ticket',
    timestamps: false,
  }
);

export default Ticket;