import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface WristbandColorAttributes {
  id: number;
  slug: string;
  label: string;
  image_path: string;
  bg_color: string;
  available_quantity: number;
  sort_order: number;
}

interface WristbandColorCreationAttributes extends Optional<WristbandColorAttributes, 'id' | 'available_quantity' | 'sort_order'> {}

class WristbandColor extends Model<WristbandColorAttributes, WristbandColorCreationAttributes> implements WristbandColorAttributes {
  public id!: number;
  public slug!: string;
  public label!: string;
  public image_path!: string;
  public bg_color!: string;
  public available_quantity!: number;
  public sort_order!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

WristbandColor.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    slug: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    image_path: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    bg_color: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    available_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'wristband_color',
    timestamps: true,
    underscored: true,
  }
);

export default WristbandColor;
