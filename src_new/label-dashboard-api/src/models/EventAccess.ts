import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

type AccessStatus = 'Pending' | 'Invited' | 'Accepted';
type AccessRole = 'viewer' | 'manager';

interface EventAccessAttributes {
  event_id: number;
  user_id: number | null;
  invite_email: string;
  role: AccessRole;
  status: AccessStatus;
  invite_hash?: string;
}

interface EventAccessCreationAttributes extends Optional<EventAccessAttributes,
  'user_id' | 'role' | 'status' | 'invite_hash'> {}

class EventAccess extends Model<EventAccessAttributes, EventAccessCreationAttributes> implements EventAccessAttributes {
  public event_id!: number;
  public user_id!: number | null;
  public invite_email!: string;
  public role!: AccessRole;
  public status!: AccessStatus;
  public invite_hash?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EventAccess.init(
  {
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      primaryKey: true,
    },
    invite_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('viewer', 'manager'),
      allowNull: false,
      defaultValue: 'viewer',
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Invited', 'Accepted'),
      allowNull: false,
      defaultValue: 'Invited',
    },
    invite_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'event_access',
    timestamps: true,
    underscored: true,
  }
);

export default EventAccess;
