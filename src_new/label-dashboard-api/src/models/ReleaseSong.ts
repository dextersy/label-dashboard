import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ReleaseSongAttributes {
  id: number;
  release_id: number;
  song_id: number;
  track_number?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ReleaseSongCreationAttributes extends Optional<ReleaseSongAttributes, 'id' | 'track_number' | 'createdAt' | 'updatedAt'> {}

class ReleaseSong extends Model<ReleaseSongAttributes, ReleaseSongCreationAttributes> implements ReleaseSongAttributes {
  public id!: number;
  public release_id!: number;
  public song_id!: number;
  public track_number?: number;

  // Association properties
  public release?: any;
  public song?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ReleaseSong.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    release_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'release',
        key: 'id'
      },
    },
    song_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'song',
        key: 'id'
      },
    },
    track_number: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    tableName: 'release_song',
    timestamps: true,
  }
);

export default ReleaseSong;
