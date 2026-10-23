import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface AudiencePushNotifPreferenceAttributes {
  id: number;
  audience_user_id: number;
  connection_requests: boolean;
  new_events: boolean;
  points_rewards: boolean;
}

interface AudiencePushNotifPreferenceCreationAttributes
  extends Optional<AudiencePushNotifPreferenceAttributes, 'id'> {}

class AudiencePushNotifPreference
  extends Model<AudiencePushNotifPreferenceAttributes, AudiencePushNotifPreferenceCreationAttributes>
  implements AudiencePushNotifPreferenceAttributes
{
  public id!: number;
  public audience_user_id!: number;
  public connection_requests!: boolean;
  public new_events!: boolean;
  public points_rewards!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AudiencePushNotifPreference.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    audience_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    connection_requests: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    new_events: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    points_rewards: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'audience_push_notif_preference',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default AudiencePushNotifPreference;
