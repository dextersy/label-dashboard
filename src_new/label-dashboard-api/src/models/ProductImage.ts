import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ProductImageAttributes {
  id: number;
  product_id: number;
  path: string;
  sort_order: number;
}

interface ProductImageCreationAttributes extends Optional<ProductImageAttributes, 'id' | 'sort_order'> {}

class ProductImage extends Model<ProductImageAttributes, ProductImageCreationAttributes> implements ProductImageAttributes {
  public id!: number;
  public product_id!: number;
  public path!: string;
  public sort_order!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ProductImage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    path: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'product_image',
    timestamps: false,
    indexes: [
      { fields: ['product_id'] },
    ],
  }
);

export default ProductImage;
