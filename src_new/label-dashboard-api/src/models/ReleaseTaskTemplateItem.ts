import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ReleaseTaskTemplateItemAttributes {
  id: number;
  template_id: number;
  title: string;
  notes?: string;
  days_before_release?: number;
  sort_order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ReleaseTaskTemplateItemCreationAttributes extends Optional<ReleaseTaskTemplateItemAttributes, 'id' | 'sort_order'> {}

class ReleaseTaskTemplateItem extends Model<ReleaseTaskTemplateItemAttributes, ReleaseTaskTemplateItemCreationAttributes> implements ReleaseTaskTemplateItemAttributes {
  public id!: number;
  public template_id!: number;
  public title!: string;
  public notes?: string;
  public days_before_release?: number;
  public sort_order!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ReleaseTaskTemplateItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    template_id: {
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
    days_before_release: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'release_task_template_item',
    timestamps: true,
  }
);

export default ReleaseTaskTemplateItem;
