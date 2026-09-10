import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface BrandHiddenTemplateAttributes {
  id: number;
  brand_id: number;
  template_id: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BrandHiddenTemplateCreationAttributes extends Optional<BrandHiddenTemplateAttributes, 'id'> {}

class BrandHiddenTemplate extends Model<BrandHiddenTemplateAttributes, BrandHiddenTemplateCreationAttributes> implements BrandHiddenTemplateAttributes {
  public id!: number;
  public brand_id!: number;
  public template_id!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BrandHiddenTemplate.init(
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
    template_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'brand_hidden_template',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['brand_id', 'template_id'] },
    ],
  }
);

export default BrandHiddenTemplate;
