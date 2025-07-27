import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ArtistAttributes {
  id: number;
  name: string;
  facebook_handle?: string;
  instagram_handle?: string;
  twitter_handle?: string;
  bio?: string;
  website_page_url?: string;
  profile_photo?: string;
  brand_id: number;
  tiktok_handle?: string;
  band_members?: string;
  youtube_channel?: string;
  payout_point: number;
  hold_payouts?: boolean;
}

interface ArtistCreationAttributes extends Optional<ArtistAttributes, 'id' | 'brand_id' | 'payout_point'> {}

class Artist extends Model<ArtistAttributes, ArtistCreationAttributes> implements ArtistAttributes {
  public id!: number;
  public name!: string;
  public facebook_handle?: string;
  public instagram_handle?: string;
  public twitter_handle?: string;
  public bio?: string;
  public website_page_url?: string;
  public profile_photo?: string;
  public brand_id!: number;
  public tiktok_handle?: string;
  public band_members?: string;
  public youtube_channel?: string;
  public payout_point!: number;
  public hold_payouts?: boolean;

  // Association properties
  public brand?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Artist.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    facebook_handle: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    instagram_handle: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    twitter_handle: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    bio: {
      type: DataTypes.STRING(4096),
      allowNull: true,
    },
    website_page_url: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
    profile_photo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    tiktok_handle: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    band_members: {
      type: DataTypes.STRING(4096),
      allowNull: true,
    },
    youtube_channel: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    payout_point: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000,
    },
    hold_payouts: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'artist',
    timestamps: false,
  }
);

export default Artist;