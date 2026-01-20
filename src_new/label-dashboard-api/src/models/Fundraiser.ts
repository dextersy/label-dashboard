import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

type FundraiserStatus = 'draft' | 'published' | 'closed';

interface FundraiserAttributes {
  id: number;
  brand_id: number;
  title: string;
  description?: string;
  poster_url?: string;
  status: FundraiserStatus;
}

interface FundraiserCreationAttributes extends Optional<FundraiserAttributes, 'id' | 'status'> {}

class Fundraiser extends Model<FundraiserAttributes, FundraiserCreationAttributes> implements FundraiserAttributes {
  public id!: number;
  public brand_id!: number;
  public title!: string;
  public description?: string;
  public poster_url?: string;
  public status!: FundraiserStatus;

  // Association properties
  public brand?: any;
  public donations?: any[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Fundraiser.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    poster_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'closed'),
      allowNull: false,
      defaultValue: 'draft',
    },
  },
  {
    sequelize,
    tableName: 'fundraiser',
    timestamps: true,
  }
);

export default Fundraiser;
