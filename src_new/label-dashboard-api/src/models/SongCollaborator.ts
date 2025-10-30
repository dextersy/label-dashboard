import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface SongCollaboratorAttributes {
  id: number;
  song_id: number;
  artist_id: number;
  role?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SongCollaboratorCreationAttributes extends Optional<SongCollaboratorAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class SongCollaborator extends Model<SongCollaboratorAttributes, SongCollaboratorCreationAttributes> implements SongCollaboratorAttributes {
  public id!: number;
  public song_id!: number;
  public artist_id!: number;
  public role?: string;

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
    role: {
      type: DataTypes.STRING(100),
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
    tableName: 'song_collaborator',
    timestamps: true,
  }
);

export default SongCollaborator;
