import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface SongAttributes {
  id: number;
  brand_id: number;
  release_id: number;
  title: string;
  track_number?: number;
  duration?: number;
  lyrics?: string;
  audio_file?: string;
  audio_file_size?: number;
  isrc?: string;
  spotify_link?: string;
  apple_music_link?: string;
  youtube_link?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SongCreationAttributes extends Optional<SongAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class Song extends Model<SongAttributes, SongCreationAttributes> implements SongAttributes {
  public id!: number;
  public brand_id!: number;
  public release_id!: number;
  public title!: string;
  public track_number?: number;
  public duration?: number;
  public lyrics?: string;
  public audio_file?: string;
  public audio_file_size?: number;
  public isrc?: string;
  public spotify_link?: string;
  public apple_music_link?: string;
  public youtube_link?: string;

  // Association properties
  public release?: any;
  public collaborators?: any[];
  public authors?: any[];
  public composers?: any[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Song.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'brand',
        key: 'id'
      },
    },
    release_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'release',
        key: 'id'
      },
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    track_number: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    lyrics: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    audio_file: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    audio_file_size: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    isrc: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    spotify_link: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
    apple_music_link: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
    youtube_link: {
      type: DataTypes.STRING(1024),
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
    tableName: 'song',
    timestamps: true,
  }
);

export default Song;
