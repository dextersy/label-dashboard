import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface EventTagAttributes {
  id: number;
  name: string;
  is_custom: boolean;
  brand_id?: number | null;
}

interface EventTagCreationAttributes extends Optional<EventTagAttributes, 'id'> {}

class EventTag extends Model<EventTagAttributes, EventTagCreationAttributes> implements EventTagAttributes {
  public id!: number;
  public name!: string;
  public is_custom!: boolean;
  public brand_id?: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EventTag.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    is_custom: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'event_tag',
    timestamps: true,
  }
);

export default EventTag;
