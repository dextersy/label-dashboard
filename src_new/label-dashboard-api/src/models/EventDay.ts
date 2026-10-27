import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface EventDayAttributes {
  id: number;
  event_id: number;
  date_and_time: Date;
  label?: string | null;
}

interface EventDayCreationAttributes extends Optional<EventDayAttributes, 'id'> {}

class EventDay extends Model<EventDayAttributes, EventDayCreationAttributes> implements EventDayAttributes {
  public id!: number;
  public event_id!: number;
  public date_and_time!: Date;
  public label?: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EventDay.init(
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
    date_and_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'event_day',
    timestamps: true,
    underscored: true,
  }
);

export default EventDay;
