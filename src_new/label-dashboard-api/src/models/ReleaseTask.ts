import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type ReleaseTaskStatus = 'not_started' | 'in_progress' | 'done';

interface ReleaseTaskAttributes {
  id: number;
  release_id: number;
  brand_id: number;
  title: string;
  notes?: string;
  due_date?: string;
  assigned_user_id?: number;
  status: ReleaseTaskStatus;
  created_by_user_id: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ReleaseTaskCreationAttributes extends Optional<ReleaseTaskAttributes, 'id' | 'status'> {}

class ReleaseTask extends Model<ReleaseTaskAttributes, ReleaseTaskCreationAttributes> implements ReleaseTaskAttributes {
  public id!: number;
  public release_id!: number;
  public brand_id!: number;
  public title!: string;
  public notes?: string;
  public due_date?: string;
  public assigned_user_id?: number;
  public status!: ReleaseTaskStatus;
  public created_by_user_id!: number;

  // Association properties
  public assignedUser?: any;
  public createdByUser?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ReleaseTask.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    release_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    assigned_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('not_started', 'in_progress', 'done'),
      allowNull: false,
      defaultValue: 'not_started',
    },
    created_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'release_task',
    timestamps: true,
  }
);

export default ReleaseTask;
