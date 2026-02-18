import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

type RoyaltyType = 'Revenue' | 'Profit';

interface SongCollaboratorAttributes {
  id: number;
  song_id: number;
  artist_id: number;
  streaming_royalty_percentage: number;
  streaming_royalty_type: RoyaltyType;
  sync_royalty_percentage: number;
  sync_royalty_type: RoyaltyType;
  download_royalty_percentage: number;
  download_royalty_type: RoyaltyType;
  physical_royalty_percentage: number;
  physical_royalty_type: RoyaltyType;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SongCollaboratorCreationAttributes extends Optional<SongCollaboratorAttributes,
  'id' | 'createdAt' | 'updatedAt' |
  'streaming_royalty_percentage' | 'streaming_royalty_type' |
  'sync_royalty_percentage' | 'sync_royalty_type' |
  'download_royalty_percentage' | 'download_royalty_type' |
  'physical_royalty_percentage' | 'physical_royalty_type'> {}

class SongCollaborator extends Model<SongCollaboratorAttributes, SongCollaboratorCreationAttributes> implements SongCollaboratorAttributes {
  public id!: number;
  public song_id!: number;
  public artist_id!: number;
  public streaming_royalty_percentage!: number;
  public streaming_royalty_type!: RoyaltyType;
  public sync_royalty_percentage!: number;
  public sync_royalty_type!: RoyaltyType;
  public download_royalty_percentage!: number;
  public download_royalty_type!: RoyaltyType;
  public physical_royalty_percentage!: number;
  public physical_royalty_type!: RoyaltyType;

  // Association properties
  public song?: any;
  public artist?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SongCollaborator.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    song_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'song',
        key: 'id'
      },
    },
    artist_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'artist',
        key: 'id'
      },
    },
    streaming_royalty_percentage: {
      type: DataTypes.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0.500,
    },
    streaming_royalty_type: {
      type: DataTypes.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue',
    },
    sync_royalty_percentage: {
      type: DataTypes.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0.500,
    },
    sync_royalty_type: {
      type: DataTypes.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue',
    },
    download_royalty_percentage: {
      type: DataTypes.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0.500,
    },
    download_royalty_type: {
      type: DataTypes.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue',
    },
    physical_royalty_percentage: {
      type: DataTypes.DECIMAL(4, 3),
      allowNull: false,
      defaultValue: 0.200,
    },
    physical_royalty_type: {
      type: DataTypes.ENUM('Revenue', 'Profit'),
      allowNull: false,
      defaultValue: 'Revenue',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'song_collaborator',
    timestamps: true,
  }
);

export default SongCollaborator;
