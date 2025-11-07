import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ArtistDocumentAttributes {
  id: number;
  title?: string;
  path: string;
  date_uploaded?: Date;
  artist_id: number;
}

interface ArtistDocumentCreationAttributes extends Optional<ArtistDocumentAttributes, 'id'> {}

class ArtistDocument extends Model<ArtistDocumentAttributes, ArtistDocumentCreationAttributes> implements ArtistDocumentAttributes {
  public id!: number;
  public title?: string;
  public path!: string;
  public date_uploaded?: Date;
  public artist_id!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ArtistDocument.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    path: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    date_uploaded: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    artist_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'artist_documents',
    timestamps: false,
  }
);

export default ArtistDocument;