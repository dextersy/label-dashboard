import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface TicketTypeDayAttributes {
  id: number;
  ticket_type_id: number;
  event_day_id: number;
}

interface TicketTypeDayCreationAttributes extends Optional<TicketTypeDayAttributes, 'id'> {}

class TicketTypeDay extends Model<TicketTypeDayAttributes, TicketTypeDayCreationAttributes> implements TicketTypeDayAttributes {
  public id!: number;
  public ticket_type_id!: number;
  public event_day_id!: number;
}

TicketTypeDay.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ticket_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    event_day_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'ticket_type_day',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['ticket_type_id', 'event_day_id'] }
    ],
  }
);

export default TicketTypeDay;
