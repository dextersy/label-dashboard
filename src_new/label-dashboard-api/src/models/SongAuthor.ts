import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface SongAuthorAttributes {
  id: number;
  song_id: number;
  songwriter_id: number;
  share_percentage?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SongAuthorCreationAttributes extends Optional<SongAuthorAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class SongAuthor extends Model<SongAuthorAttributes, SongAuthorCreationAttributes> implements SongAuthorAttributes {
  public id!: number;
  public song_id!: number;
  public songwriter_id!: number;
  public share_percentage?: number;

  // Association properties
  public song?: any;
  public songwriter?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SongAuthor.init(
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
    songwriter_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'songwriter',
        key: 'id'
      },
    },
    share_percentage: {
      type: DataTypes.DECIMAL(5, 2),
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
    tableName: 'song_author',
    timestamps: true,
  }
);

export default SongAuthor;
