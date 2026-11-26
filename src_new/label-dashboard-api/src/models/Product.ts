import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';

type ProductStatus = 'active' | 'inactive';

interface ProductAttributes {
  id: number;
  name: string;
  sku?: string | null;
  description?: string | null;
  price?: number | null;
  brand_id: number;
  release_id?: number | null;
  artist_id?: number | null;
  status: ProductStatus;
}

interface ProductCreationAttributes extends Optional<ProductAttributes, 'id' | 'status'> {}

class Product extends Model<ProductAttributes, ProductCreationAttributes> implements ProductAttributes {
  public id!: number;
  public name!: string;
  public sku?: string | null;
  public description?: string | null;
  public price?: number | null;
  public brand_id!: number;
  public release_id?: number | null;
  public artist_id?: number | null;
  public status!: ProductStatus;

  // Association properties
  public brand?: any;
  public release?: any;
  public artist?: any;
  public images?: any[];
  public productArtists?: any[];
  public earnings?: any[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Product.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    sku: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        const value = this.getDataValue('price');
        return value !== null && value !== undefined ? parseFloat(String(value)) : null;
      },
      set(value: any) {
        this.setDataValue('price', value !== null && value !== undefined ? parseFloat(value) : null);
      }
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    release_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    artist_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active',
    },
  },
  {
    sequelize,
    tableName: 'product',
    timestamps: false,
    indexes: [
      { fields: ['brand_id'] },
      { fields: ['brand_id', 'status'] },
      { fields: ['release_id'] },
      { fields: ['artist_id'] },
      {
        unique: true,
        fields: ['brand_id', 'sku'],
        where: { sku: { [Op.ne]: null } },
        name: 'product_brand_sku_unique',
      },
    ],
  }
);

export default Product;
