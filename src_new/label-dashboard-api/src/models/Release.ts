import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

type ReleaseStatus = 'Draft' | 'For Submission' | 'Pending' | 'Live' | 'Taken Down';

interface ReleaseAttributes {
  id: number;
  title?: string;
  catalog_no: string;
  UPC?: string;
  spotify_link?: string;
  apple_music_link?: string;
  youtube_link?: string;
  release_date?: Date;
  status: ReleaseStatus;
  cover_art?: string;
  description?: string;
  liner_notes?: string;
  brand_id: number;
  exclude_from_epk: boolean;
}

interface ReleaseCreationAttributes extends Optional<ReleaseAttributes, 'id' | 'status' | 'exclude_from_epk'> {}

class Release extends Model<ReleaseAttributes, ReleaseCreationAttributes> implements ReleaseAttributes {
  public id!: number;
  public title?: string;
  public catalog_no!: string;
  public UPC?: string;
  public spotify_link?: string;
  public apple_music_link?: string;
  public youtube_link?: string;
  public release_date?: Date;
  public status!: ReleaseStatus;
  public cover_art?: string;
  public description?: string;
  public liner_notes?: string;
  public brand_id!: number;
  public exclude_from_epk!: boolean;

  // Association properties
  public releaseArtists?: any[];
  public earnings?: any[];
  public artists?: any[];
  public brand?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Release.init(
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
    catalog_no: {
      type: DataTypes.STRING(6),
      allowNull: false,
      unique: true,
    },
    UPC: {
      type: DataTypes.STRING(45),
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
    release_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isValidDate(value: any) {
          if (value === '0000-00-00' || value === '') {
            return null;
          }
        }
      },
      set(value: any) {
        if (value === '0000-00-00' || value === '') {
          this.setDataValue('release_date', null);
        } else {
          this.setDataValue('release_date', value);
        }
      }
    },
    status: {
      type: DataTypes.ENUM('Draft', 'For Submission', 'Pending', 'Live', 'Taken Down'),
      allowNull: false,
      defaultValue: 'Draft',
    },
    cover_art: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    liner_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    exclude_from_epk: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'release',
    timestamps: false,
  }
);

export default Release;