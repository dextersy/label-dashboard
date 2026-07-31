import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PressCampaignAttributes {
  id: number;
  brand_id: number;
  title: string;
  writeup?: string;
  campaign_type: 'release' | 'event';
  release_id?: number;
  artist_id?: number;
  event_id?: number;
  cover_art?: string;
  mp3_file?: string;
  public_slug: string;
  status: 'Draft' | 'Published' | 'Sent';
  created_by: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PressCampaignCreationAttributes extends Optional<PressCampaignAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class PressCampaign extends Model<PressCampaignAttributes, PressCampaignCreationAttributes> implements PressCampaignAttributes {
  public id!: number;
  public brand_id!: number;
  public title!: string;
  public writeup?: string;
  public campaign_type!: 'release' | 'event';
  public release_id?: number;
  public artist_id?: number;
  public event_id?: number;
  public cover_art?: string;
  public mp3_file?: string;
  public public_slug!: string;
  public status!: 'Draft' | 'Published' | 'Sent';
  public created_by!: number;

  public artist?: any;
  public release?: any;
  public event?: any;
  public artistPhotos?: any[];
  public creator?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PressCampaign.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'brand', key: 'id' },
      onUpdate: 'NO ACTION',
      onDelete: 'CASCADE',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    writeup: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    campaign_type: {
      type: DataTypes.ENUM('release', 'event'),
      allowNull: false,
      defaultValue: 'release',
    },
    release_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'release', key: 'id' },
      onUpdate: 'NO ACTION',
      onDelete: 'SET NULL',
    },
    artist_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'artist', key: 'id' },
      onUpdate: 'NO ACTION',
      onDelete: 'SET NULL',
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'event', key: 'id' },
      onUpdate: 'NO ACTION',
      onDelete: 'SET NULL',
    },
    cover_art: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    mp3_file: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    public_slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM('Draft', 'Published', 'Sent'),
      allowNull: false,
      defaultValue: 'Draft',
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'user', key: 'id' },
      onUpdate: 'NO ACTION',
      onDelete: 'NO ACTION',
    },
  },
  {
    sequelize,
    tableName: 'press_campaign',
    timestamps: true,
  }
);

export default PressCampaign;
