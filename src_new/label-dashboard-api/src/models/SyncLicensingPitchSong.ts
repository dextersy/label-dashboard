import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface SyncLicensingPitchSongAttributes {
  id: number;
  pitch_id: number;
  song_id: number;
  createdAt?: Date;
}

interface SyncLicensingPitchSongCreationAttributes extends Optional<SyncLicensingPitchSongAttributes, 'id' | 'createdAt'> {}

class SyncLicensingPitchSong extends Model<SyncLicensingPitchSongAttributes, SyncLicensingPitchSongCreationAttributes> implements SyncLicensingPitchSongAttributes {
  public id!: number;
  public pitch_id!: number;
  public song_id!: number;

  // Association properties
  public pitch?: any;
  public song?: any;

  public readonly createdAt!: Date;
}

SyncLicensingPitchSong.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    pitch_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sync_licensing_pitch',
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
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'sync_licensing_pitch_song',
    timestamps: true,
    updatedAt: false, // Junction table doesn't need updatedAt
  }
);

export default SyncLicensingPitchSong;
