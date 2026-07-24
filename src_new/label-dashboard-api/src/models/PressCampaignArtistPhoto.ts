import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PressCampaignArtistPhotoAttributes {
  id: number;
  campaign_id: number;
  path: string;
  label?: string;
  sort_order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PressCampaignArtistPhotoCreationAttributes extends Optional<PressCampaignArtistPhotoAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class PressCampaignArtistPhoto extends Model<PressCampaignArtistPhotoAttributes, PressCampaignArtistPhotoCreationAttributes> implements PressCampaignArtistPhotoAttributes {
  public id!: number;
  public campaign_id!: number;
  public path!: string;
  public label?: string;
  public sort_order!: number;

  public campaign?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PressCampaignArtistPhoto.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    campaign_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'press_campaign', key: 'id' },
      onUpdate: 'NO ACTION',
      onDelete: 'CASCADE',
    },
    path: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'press_campaign_artist_photo',
    timestamps: true,
  }
);

export default PressCampaignArtistPhoto;
