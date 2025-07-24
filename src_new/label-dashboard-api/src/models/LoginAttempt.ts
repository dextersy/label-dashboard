import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

type LoginStatus = 'Successful' | 'Failed';

interface LoginAttemptAttributes {
  id: number;
  user_id: number;
  status: LoginStatus;
  date_and_time: Date;
  brand_id: number;
  proxy_ip?: string;
  remote_ip?: string;
}

interface LoginAttemptCreationAttributes extends Optional<LoginAttemptAttributes, 'id'> {}

class LoginAttempt extends Model<LoginAttemptAttributes, LoginAttemptCreationAttributes> implements LoginAttemptAttributes {
  public id!: number;
  public user_id!: number;
  public status!: LoginStatus;
  public date_and_time!: Date;
  public brand_id!: number;
  public proxy_ip?: string;
  public remote_ip?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

LoginAttempt.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('Successful', 'Failed'),
      allowNull: false,
    },
    date_and_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    proxy_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    remote_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'login_attempt',
    timestamps: false,
  }
);

export default LoginAttempt;