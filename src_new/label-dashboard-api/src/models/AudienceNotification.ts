import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type AudienceNotificationType =
  | 'connection_request'
  | 'connection_accepted'
  | 'invite_joined';

interface AudienceNotificationAttributes {
  id: number;
  audience_user_id: number;
  type: AudienceNotificationType;
  title: string;
  message?: string | null;
  link?: string | null;
  actor_id?: number | null;
  is_read: boolean;
  created_at?: Date;
}

interface AudienceNotificationCreationAttributes
  extends Optional<AudienceNotificationAttributes, 'id' | 'is_read'> {}

class AudienceNotification
  extends Model<AudienceNotificationAttributes, AudienceNotificationCreationAttributes>
  implements AudienceNotificationAttributes
{
  public id!: number;
  public audience_user_id!: number;
  public type!: AudienceNotificationType;
  public title!: string;
  public message?: string | null;
  public link?: string | null;
  public actor_id?: number | null;
  public is_read!: boolean;
  public readonly created_at!: Date;
}

AudienceNotification.init(
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
    type: {
      type: DataTypes.ENUM('connection_request', 'connection_accepted', 'invite_joined'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    link: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    actor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'audience_notification',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['audience_user_id'] },
      { fields: ['audience_user_id', 'is_read'] },
    ],
  },
);

export default AudienceNotification;
