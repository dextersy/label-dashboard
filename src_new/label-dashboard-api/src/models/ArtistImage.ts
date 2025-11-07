import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ArtistImageAttributes {
  id: number;
  path: string;
  credits?: string;
  artist_id: number;
  date_uploaded: Date;
}

interface ArtistImageCreationAttributes extends Optional<ArtistImageAttributes, 'id'> {}

class ArtistImage extends Model<ArtistImageAttributes, ArtistImageCreationAttributes> implements ArtistImageAttributes {
  public id!: number;
  public path!: string;
  public credits?: string;
  public artist_id!: number;
  public date_uploaded!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ArtistImage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    path: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    credits: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
    artist_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    date_uploaded: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'artist_image',
    timestamps: false,
  }
);

export default ArtistImage;