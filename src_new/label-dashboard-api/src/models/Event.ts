import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface EventAttributes {
  id: number;
  brand_id: number;
  title: string;
  date_and_time: Date;
  venue: string;
  description?: string;
  poster_url?: string;
  rsvp_link?: string;
  ticket_price: number;
  buy_shortlink?: string;
  close_time?: Date;
}

interface EventCreationAttributes extends Optional<EventAttributes, 'id'> {}

class Event extends Model<EventAttributes, EventCreationAttributes> implements EventAttributes {
  public id!: number;
  public brand_id!: number;
  public title!: string;
  public date_and_time!: Date;
  public venue!: string;
  public description?: string;
  public poster_url?: string;
  public rsvp_link?: string;
  public ticket_price!: number;
  public buy_shortlink?: string;
  public close_time?: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Event.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    date_and_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    venue: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
    poster_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    rsvp_link: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ticket_price: {
      type: DataTypes.DECIMAL(10, 0),
      allowNull: false,
    },
    buy_shortlink: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
    close_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'event',
    timestamps: false,
  }
);

export default Event;