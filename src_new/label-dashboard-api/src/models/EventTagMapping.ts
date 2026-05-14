import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

interface EventTagMappingAttributes {
  event_id: number;
  tag_id: number;
}

class EventTagMapping extends Model<EventTagMappingAttributes> implements EventTagMappingAttributes {
  public event_id!: number;
  public tag_id!: number;
}

EventTagMapping.init(
  {
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    tag_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
  },
  {
    sequelize,
    tableName: 'event_tag_mapping',
    timestamps: false,
  }
);

export default EventTagMapping;
