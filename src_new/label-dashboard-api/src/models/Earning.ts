import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

type EarningType = 'Sync' | 'Streaming' | 'Downloads' | 'Physical';

interface ReleaseAssociation {
  id: number;
  title: string;
}

interface EarningAttributes {
  id: number;
  release_id: number;
  type: EarningType;
  amount?: number;
  description?: string;
  date_recorded: Date;
  platform_fee?: number;
}

interface EarningCreationAttributes extends Optional<EarningAttributes, 'id' | 'type'> {}

class Earning extends Model<EarningAttributes, EarningCreationAttributes> implements EarningAttributes {
  public id!: number;
  public release_id!: number;
  public type!: EarningType;
  public amount?: number;
  public description?: string;
  public date_recorded!: Date;
  public platform_fee?: number;

  // Association
  public release?: ReleaseAssociation;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Earning.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    release_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('Sync', 'Streaming', 'Downloads', 'Physical'),
      allowNull: false,
      defaultValue: 'Streaming',
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    date_recorded: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    platform_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      get() {
        const value = this.getDataValue('platform_fee');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
      set(value: any) {
        this.setDataValue('platform_fee', value !== null && value !== undefined ? parseFloat(value) : value);
      }
    },
  },
  {
    sequelize,
    tableName: 'earning',
    timestamps: false,
  }
);

export default Earning;