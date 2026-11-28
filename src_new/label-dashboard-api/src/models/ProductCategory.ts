import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';

interface ProductCategoryAttributes {
  id: number;
  brand_id: number;
  name: string;
  slug?: string | null;
  description?: string | null;
  color?: string | null;
  sort_order: number;
  is_visible: boolean;
  woocommerce_id?: number | null;
  shopify_id?: string | null;
  loyverse_id?: string | null;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

interface ProductCategoryCreationAttributes extends Optional<ProductCategoryAttributes, 'id' | 'sort_order' | 'is_visible'> {}

class ProductCategory extends Model<ProductCategoryAttributes, ProductCategoryCreationAttributes> implements ProductCategoryAttributes {
  public id!: number;
  public brand_id!: number;
  public name!: string;
  public slug?: string | null;
  public description?: string | null;
  public color?: string | null;
  public sort_order!: number;
  public is_visible!: boolean;
  public woocommerce_id?: number | null;
  public shopify_id?: string | null;
  public loyverse_id?: string | null;

  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public deleted_at?: Date | null;

  // Association properties
  public products?: any[];
}

ProductCategory.init(
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_visible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    woocommerce_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    shopify_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    loyverse_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'product_category',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
    indexes: [
      { fields: ['brand_id'] },
      { unique: true, fields: ['brand_id', 'slug'], where: { slug: { [Op.ne]: null } }, name: 'product_category_brand_slug_unique' },
    ],
  }
);

export default ProductCategory;
