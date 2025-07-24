import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface RoyaltyAttributes {
  id: number;
  artist_id: number;
  earning_id?: number;
  percentage_of_earning?: number;
  amount: number;
  release_id?: number;
  description?: string;
  date_recorded: Date;
}

interface RoyaltyCreationAttributes extends Optional<RoyaltyAttributes, 'id'> {}

class Royalty extends Model<RoyaltyAttributes, RoyaltyCreationAttributes> implements RoyaltyAttributes {
  public id!: number;
  public artist_id!: number;
  public earning_id?: number;
  public percentage_of_earning?: number;
  public amount!: number;
  public release_id?: number;
  public description?: string;
  public date_recorded!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Royalty.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    artist_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    earning_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    percentage_of_earning: {
      type: DataTypes.DECIMAL(3, 3),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    release_id: {
      type: DataTypes.INTEGER,
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
    tableName: 'royalty',
    timestamps: false,
  }
);

export default Royalty;