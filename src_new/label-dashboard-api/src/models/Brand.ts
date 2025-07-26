import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface BrandAttributes {
  id: number;
  brand_name: string;
  logo_url?: string;
  brand_color: string;
  paymongo_wallet_id?: string;
  payment_processing_fee_for_payouts?: number;
}

interface BrandCreationAttributes extends Optional<BrandAttributes, 'id' | 'brand_color'> {}

class Brand extends Model<BrandAttributes, BrandCreationAttributes> implements BrandAttributes {
  public id!: number;
  public brand_name!: string;
  public logo_url?: string;
  public brand_color!: string;
  public paymongo_wallet_id?: string;
  public payment_processing_fee_for_payouts?: number;

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
    paymongo_wallet_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    payment_processing_fee_for_payouts: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'brand',
    timestamps: false,
  }
);

export default Brand;