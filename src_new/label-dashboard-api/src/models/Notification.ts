import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface NotificationAttributes {
  id: number;
  user_id: number;
  brand_id: number;
  type: string;
  title: string;
  message?: string;
  link?: string;
  is_read: boolean;
  created_at: Date;
}

interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'id' | 'is_read' | 'created_at'> {}

class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  public id!: number;
  public user_id!: number;
  public brand_id!: number;
  public type!: string;
  public title!: string;
  public message?: string;
  public link?: string;
  public is_read!: boolean;
  public created_at!: Date;
}

Notification.init(
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
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(100),
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
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'notification',
    timestamps: false,
  }
);

export default Notification;
