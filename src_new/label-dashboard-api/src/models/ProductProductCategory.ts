import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

interface ProductProductCategoryAttributes {
  product_id: number;
  category_id: number;
}

class ProductProductCategory extends Model<ProductProductCategoryAttributes> implements ProductProductCategoryAttributes {
  public product_id!: number;
  public category_id!: number;
}

ProductProductCategory.init(
  {
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
  },
  {
    sequelize,
    tableName: 'product_product_category',
    timestamps: false,
    indexes: [
      { fields: ['product_id'] },
      { fields: ['category_id'] },
    ],
  }
);

export default ProductProductCategory;
