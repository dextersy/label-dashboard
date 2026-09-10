import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ReleaseTaskTemplateAttributes {
  id: number;
  brand_id: number;
  created_by_user_id: number;
  name: string;
  description?: string;
  is_public: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ReleaseTaskTemplateCreationAttributes extends Optional<ReleaseTaskTemplateAttributes, 'id' | 'is_public'> {}

class ReleaseTaskTemplate extends Model<ReleaseTaskTemplateAttributes, ReleaseTaskTemplateCreationAttributes> implements ReleaseTaskTemplateAttributes {
  public id!: number;
  public brand_id!: number;
  public created_by_user_id!: number;
  public name!: string;
  public description?: string;
  public is_public!: boolean;

  // Association properties
  public items?: any[];
  public createdByUser?: any;
  public brand?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ReleaseTaskTemplate.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'release_task_template',
    timestamps: true,
  }
);

export default ReleaseTaskTemplate;
