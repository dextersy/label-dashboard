import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type PointTransactionType = 'ticket_purchase' | 'event_share' | 'referral';

interface AudiencePointTransactionAttributes {
  id: number;
  audience_user_id: number;
  type: PointTransactionType;
  points: number;
  reference_id?: number | null;
  reference_type?: string | null;
  created_at?: Date;
}

interface AudiencePointTransactionCreationAttributes
  extends Optional<AudiencePointTransactionAttributes, 'id'> {}

class AudiencePointTransaction
  extends Model<AudiencePointTransactionAttributes, AudiencePointTransactionCreationAttributes>
  implements AudiencePointTransactionAttributes
{
  public id!: number;
  public audience_user_id!: number;
  public type!: PointTransactionType;
  public points!: number;
  public reference_id?: number | null;
  public reference_type?: string | null;
  public readonly created_at!: Date;
}

AudiencePointTransaction.init(
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
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reference_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reference_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'audience_point_transaction',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

export default AudiencePointTransaction;
