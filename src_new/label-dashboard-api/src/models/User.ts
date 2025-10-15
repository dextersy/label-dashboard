import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import Brand from './Brand';

interface UserAttributes {
  id: number;
  username?: string;
  password_md5?: string;
  email_address: string;
  first_name?: string;
  last_name?: string;
  profile_photo?: string;
  is_admin: boolean;
  is_system_user: boolean;
  brand_id: number | null;
  reset_hash?: string;
  last_logged_in?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'is_admin' | 'is_system_user' | 'brand_id'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public username?: string;
  public password_md5?: string;
  public email_address!: string;
  public first_name?: string;
  public last_name?: string;
  public profile_photo?: string;
  public is_admin!: boolean;
  public is_system_user!: boolean;
  public brand_id!: number | null;
  public reset_hash?: string;
  public last_logged_in?: Date;

  public brand?:Brand;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Validates system user constraints
   * System users MUST have NULL brand_id
   * Regular users MUST have non-NULL brand_id
   */
  public isValidSystemUser(): boolean {
    if (this.is_system_user) {
      return this.brand_id === null;
    }
    return this.brand_id !== null;
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    password_md5: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    email_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    profile_photo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_admin: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
    },
    is_system_user: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
    },
    reset_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    last_logged_in: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'user',
    timestamps: false,
    validate: {
      systemUserConstraint() {
        // Enforce: system users MUST have NULL brand_id, regular users MUST have non-NULL brand_id
        if (this.is_system_user && this.brand_id !== null) {
          throw new Error('System users must have NULL brand_id');
        }
        if (!this.is_system_user && this.brand_id === null) {
          throw new Error('Regular users must have a brand_id');
        }
      }
    }
  }
);

export default User;