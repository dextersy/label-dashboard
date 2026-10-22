import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type ConnectionStatus = 'pending' | 'accepted' | 'blocked';

interface AudienceConnectionAttributes {
  id: number;
  requester_id: number;
  addressee_id: number;
  status: ConnectionStatus;
  blocker_id?: number | null;
  created_at?: Date;
  updated_at?: Date;
}

interface AudienceConnectionCreationAttributes
  extends Optional<AudienceConnectionAttributes, 'id' | 'status' | 'blocker_id'> {}

class AudienceConnection
  extends Model<AudienceConnectionAttributes, AudienceConnectionCreationAttributes>
  implements AudienceConnectionAttributes
{
  public id!: number;
  public requester_id!: number;
  public addressee_id!: number;
  public status!: ConnectionStatus;
  public blocker_id!: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AudienceConnection.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    requester_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    addressee_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'blocked'),
      allowNull: false,
      defaultValue: 'pending',
    },
    blocker_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'audience_connection',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['requester_id', 'addressee_id'],
      },
      { fields: ['addressee_id'] },
    ],
  },
);

export default AudienceConnection;
