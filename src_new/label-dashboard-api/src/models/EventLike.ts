import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface EventLikeAttributes {
  id: number;
  audience_user_id: number;
  event_id: number;
}

interface EventLikeCreationAttributes extends Optional<EventLikeAttributes, 'id'> {}

class EventLike extends Model<EventLikeAttributes, EventLikeCreationAttributes> implements EventLikeAttributes {
  public id!: number;
  public audience_user_id!: number;
  public event_id!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EventLike.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    audience_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'event_like',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['audience_user_id', 'event_id'],
      },
    ],
  }
);

export default EventLike;
