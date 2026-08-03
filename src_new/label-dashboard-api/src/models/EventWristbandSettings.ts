import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface EventWristbandSettingsAttributes {
  id: number;
  event_id: number;
  delivery_name: string | null;
  delivery_street: string | null;
  delivery_city: string | null;
  delivery_country: string | null;
  delivery_zip: string | null;
  delivery_phone: string | null;
}

interface EventWristbandSettingsCreationAttributes extends Optional<
  EventWristbandSettingsAttributes,
  'id' | 'delivery_name' | 'delivery_street' | 'delivery_city' | 'delivery_country' | 'delivery_zip' | 'delivery_phone'
> {}

class EventWristbandSettings extends Model<EventWristbandSettingsAttributes, EventWristbandSettingsCreationAttributes> implements EventWristbandSettingsAttributes {
  public id!: number;
  public event_id!: number;
  public delivery_name!: string | null;
  public delivery_street!: string | null;
  public delivery_city!: string | null;
  public delivery_country!: string | null;
  public delivery_zip!: string | null;
  public delivery_phone!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EventWristbandSettings.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    delivery_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    delivery_street: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    delivery_city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    delivery_country: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    delivery_zip: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    delivery_phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'event_wristband_settings',
    timestamps: true,
    underscored: true,
  }
);

export default EventWristbandSettings;
