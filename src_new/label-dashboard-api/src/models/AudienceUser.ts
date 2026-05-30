import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface AudienceUserAttributes {
  id: number;
  email_address: string;
  password_hash?: string;
  first_name?: string;
  last_name?: string;
  reset_hash?: string;
  reset_hash_expires_at?: Date;
}

interface AudienceUserCreationAttributes extends Optional<AudienceUserAttributes, 'id'> {}

class AudienceUser extends Model<AudienceUserAttributes, AudienceUserCreationAttributes> implements AudienceUserAttributes {
  public id!: number;
  public email_address!: string;
  public password_hash?: string;
  public first_name?: string;
  public last_name?: string;
  public reset_hash?: string;
  public reset_hash_expires_at?: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AudienceUser.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    reset_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reset_hash_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'audience_user',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default AudienceUser;
