import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface EventReferrerAttributes {
  id: number;
  name: string;
  referral_code: string;
  event_id: number;
  referral_shortlink?: string;
}

interface EventReferrerCreationAttributes extends Optional<EventReferrerAttributes, 'id'> {}

class EventReferrer extends Model<EventReferrerAttributes, EventReferrerCreationAttributes> implements EventReferrerAttributes {
  public id!: number;
  public name!: string;
  public referral_code!: string;
  public event_id!: number;
  public referral_shortlink?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EventReferrer.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    referral_code: {
      type: DataTypes.STRING(45),
      allowNull: false,
      unique: true,
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    referral_shortlink: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'event_referrer',
    timestamps: false,
  }
);

export default EventReferrer;