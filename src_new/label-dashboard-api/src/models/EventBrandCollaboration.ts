import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

type CollabRole = 'viewer' | 'manager';
type CollabStatus = 'Pending' | 'Accepted';

interface EventBrandCollaborationAttributes {
  event_id: number;
  brand_id: number;
  role: CollabRole;
  status: CollabStatus;
  invite_hash?: string | null;
}

interface EventBrandCollaborationCreationAttributes
  extends Optional<EventBrandCollaborationAttributes, 'role' | 'status' | 'invite_hash'> {}

class EventBrandCollaboration
  extends Model<EventBrandCollaborationAttributes, EventBrandCollaborationCreationAttributes>
  implements EventBrandCollaborationAttributes
{
  public event_id!: number;
  public brand_id!: number;
  public role!: CollabRole;
  public status!: CollabStatus;
  public invite_hash?: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EventBrandCollaboration.init(
  {
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    role: {
      type: DataTypes.ENUM('viewer', 'manager'),
      allowNull: false,
      defaultValue: 'viewer',
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Accepted'),
      allowNull: false,
      defaultValue: 'Pending',
    },
    invite_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'event_brand_collaborations',
    timestamps: true,
    underscored: true,
  }
);

export default EventBrandCollaboration;
