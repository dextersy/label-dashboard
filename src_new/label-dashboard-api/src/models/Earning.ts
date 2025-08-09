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
}

interface EarningCreationAttributes extends Optional<EarningAttributes, 'id' | 'type'> {}

class Earning extends Model<EarningAttributes, EarningCreationAttributes> implements EarningAttributes {
  public id!: number;
  public release_id!: number;
  public type!: EarningType;
  public amount?: number;
  public description?: string;
  public date_recorded!: Date;

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
  },
  {
    sequelize,
    tableName: 'earning',
    timestamps: false,
  }
);

export default Earning;