import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface BrandAttributes {
  id: number;
  brand_name: string;
  logo_url?: string;
  brand_color: string;
  brand_website?: string;
  favicon_url?: string;
  paymongo_wallet_id?: string;
  payment_processing_fee_for_payouts?: number;
  release_submission_url?: string;
  catalog_prefix?: string;
  parent_brand?: number;
}

interface BrandCreationAttributes extends Optional<BrandAttributes, 'id' | 'brand_color'> {}

class Brand extends Model<BrandAttributes, BrandCreationAttributes> implements BrandAttributes {
  public id!: number;
  public brand_name!: string;
  public logo_url?: string;
  public brand_color!: string;
  public brand_website?: string;
  public favicon_url?: string;
  public paymongo_wallet_id?: string;
  public payment_processing_fee_for_payouts?: number;
  public release_submission_url?: string;
  public catalog_prefix?: string;
  public parent_brand?: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Brand.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    brand_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    logo_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    brand_color: {
      type: DataTypes.STRING(45),
      allowNull: false,
      defaultValue: '#ffffff',
    },
    brand_website: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    favicon_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    paymongo_wallet_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    payment_processing_fee_for_payouts: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      get() {
        // Force conversion to number when reading from database
        const value = this.getDataValue('payment_processing_fee_for_payouts');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
      set(value: any) {
        // Force conversion to number when writing to database
        this.setDataValue('payment_processing_fee_for_payouts', value !== null && value !== undefined ? parseFloat(value) : value);
      }
    },
    release_submission_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    catalog_prefix: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'REL',
    },
    parent_brand: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'brand',
        key: 'id'
      }
    },
  },
  {
    sequelize,
    tableName: 'brand',
    timestamps: false,
  }
);

export default Brand;