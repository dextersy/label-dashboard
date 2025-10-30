import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface SongAuthorAttributes {
  id: number;
  song_id: number;
  name: string;
  pro_affiliation?: string;
  ipi_number?: string;
  share_percentage?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SongAuthorCreationAttributes extends Optional<SongAuthorAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class SongAuthor extends Model<SongAuthorAttributes, SongAuthorCreationAttributes> implements SongAuthorAttributes {
  public id!: number;
  public song_id!: number;
  public name!: string;
  public pro_affiliation?: string;
  public ipi_number?: string;
  public share_percentage?: number;

  // Association properties
  public song?: any;

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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    pro_affiliation: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ipi_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
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
