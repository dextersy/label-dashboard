import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

type RoyaltyType = 'Revenue' | 'Profit';

interface ProductArtistAttributes {
  artist_id: number;
  product_id: number;
  merch_royalty_percentage: number;
  merch_royalty_type: RoyaltyType;
}

class ProductArtist extends Model<ProductArtistAttributes> implements ProductArtistAttributes {
  public artist_id!: number;
  public product_id!: number;
  public merch_royalty_percentage!: number;
  public merch_royalty_type!: RoyaltyType;

  // Association properties
  public artist?: any;
  public product?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ProductArtist.init(
  {
    artist_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    merch_royalty_percentage: {
      type: DataTypes.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0.500,
    },
    merch_royalty_type: {
      type: DataTypes.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue',
    },
  },
  {
    sequelize,
    tableName: 'product_artist',
    timestamps: false,
  }
);

export default ProductArtist;
