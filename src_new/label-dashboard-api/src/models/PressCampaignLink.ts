import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PressCampaignLinkAttributes {
  id: number;
  campaign_id: number;
  label: string;
  url: string;
  sort_order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PressCampaignLinkCreationAttributes extends Optional<PressCampaignLinkAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class PressCampaignLink extends Model<PressCampaignLinkAttributes, PressCampaignLinkCreationAttributes> implements PressCampaignLinkAttributes {
  public id!: number;
  public campaign_id!: number;
  public label!: string;
  public url!: string;
  public sort_order!: number;

  public campaign?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PressCampaignLink.init(
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
    label: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(1024),
      allowNull: false,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'press_campaign_link',
    timestamps: true,
  }
);

export default PressCampaignLink;
