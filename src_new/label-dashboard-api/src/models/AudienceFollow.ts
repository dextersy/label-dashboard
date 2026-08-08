import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface AudienceFollowAttributes {
  id: number;
  audience_user_id: number;
  brand_id: number;
}

interface AudienceFollowCreationAttributes extends Optional<AudienceFollowAttributes, 'id'> {}

class AudienceFollow extends Model<AudienceFollowAttributes, AudienceFollowCreationAttributes> implements AudienceFollowAttributes {
  public id!: number;
  public audience_user_id!: number;
  public brand_id!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AudienceFollow.init(
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
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'audience_follow',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['audience_user_id', 'brand_id'],
      },
    ],
  }
);

export default AudienceFollow;
