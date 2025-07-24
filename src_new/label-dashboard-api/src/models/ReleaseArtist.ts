import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

type RoyaltyType = 'Revenue' | 'Profit';

interface ReleaseArtistAttributes {
  artist_id: number;
  release_id: number;
  streaming_royalty_percentage: number;
  streaming_royalty_type: RoyaltyType;
  sync_royalty_percentage: number;
  sync_royalty_type: RoyaltyType;
  download_royalty_percentage: number;
  download_royalty_type: RoyaltyType;
  physical_royalty_percentage: number;
  physical_royalty_type: RoyaltyType;
}

interface ReleaseArtistCreationAttributes extends Optional<ReleaseArtistAttributes, 
  'streaming_royalty_percentage' | 'streaming_royalty_type' | 'sync_royalty_percentage' | 
  'sync_royalty_type' | 'download_royalty_percentage' | 'download_royalty_type' | 
  'physical_royalty_percentage' | 'physical_royalty_type'> {}

class ReleaseArtist extends Model<ReleaseArtistAttributes, ReleaseArtistCreationAttributes> implements ReleaseArtistAttributes {
  public artist_id!: number;
  public release_id!: number;
  public streaming_royalty_percentage!: number;
  public streaming_royalty_type!: RoyaltyType;
  public sync_royalty_percentage!: number;
  public sync_royalty_type!: RoyaltyType;
  public download_royalty_percentage!: number;
  public download_royalty_type!: RoyaltyType;
  public physical_royalty_percentage!: number;
  public physical_royalty_type!: RoyaltyType;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ReleaseArtist.init(
  {
    artist_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    release_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    streaming_royalty_percentage: {
      type: DataTypes.DECIMAL(3, 3),
      allowNull: false,
      defaultValue: 0.500,
    },
    streaming_royalty_type: {
      type: DataTypes.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue',
    },
    sync_royalty_percentage: {
      type: DataTypes.DECIMAL(3, 3),
      allowNull: false,
      defaultValue: 0.500,
    },
    sync_royalty_type: {
      type: DataTypes.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue',
    },
    download_royalty_percentage: {
      type: DataTypes.DECIMAL(3, 3),
      allowNull: false,
      defaultValue: 0.500,
    },
    download_royalty_type: {
      type: DataTypes.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue',
    },
    physical_royalty_percentage: {
      type: DataTypes.DECIMAL(3, 3),
      allowNull: false,
      defaultValue: 0.200,
    },
    physical_royalty_type: {
      type: DataTypes.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue',
    },
  },
  {
    sequelize,
    tableName: 'release_artist',
    timestamps: false,
  }
);

export default ReleaseArtist;