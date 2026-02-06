import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface SyncLicensingPitchAttributes {
  id: number;
  brand_id: number;
  title: string;
  description?: string;
  created_by: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SyncLicensingPitchCreationAttributes extends Optional<SyncLicensingPitchAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class SyncLicensingPitch extends Model<SyncLicensingPitchAttributes, SyncLicensingPitchCreationAttributes> implements SyncLicensingPitchAttributes {
  public id!: number;
  public brand_id!: number;
  public title!: string;
  public description?: string;
  public created_by!: number;

  // Association properties
  public songs?: any[];
  public creator?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SyncLicensingPitch.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'brand',
        key: 'id'
      },
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'user',
        key: 'id'
      },
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
    tableName: 'sync_licensing_pitch',
    timestamps: true,
  }
);

export default SyncLicensingPitch;
