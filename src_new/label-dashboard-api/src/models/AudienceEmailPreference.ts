import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface AudienceEmailPreferenceAttributes {
  id: number;
  audience_user_id: number;
  marketing_promos: boolean;
  event_recommendations: boolean;
  organizer_updates: boolean;
  points_rewards: boolean;
}

interface AudienceEmailPreferenceCreationAttributes
  extends Optional<AudienceEmailPreferenceAttributes, 'id'> {}

class AudienceEmailPreference
  extends Model<AudienceEmailPreferenceAttributes, AudienceEmailPreferenceCreationAttributes>
  implements AudienceEmailPreferenceAttributes
{
  public id!: number;
  public audience_user_id!: number;
  public marketing_promos!: boolean;
  public event_recommendations!: boolean;
  public organizer_updates!: boolean;
  public points_rewards!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AudienceEmailPreference.init(
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
    marketing_promos: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    event_recommendations: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    organizer_updates: {
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
    tableName: 'audience_email_preference',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default AudienceEmailPreference;
