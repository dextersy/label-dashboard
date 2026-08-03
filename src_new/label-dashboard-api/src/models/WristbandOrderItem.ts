import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface WristbandOrderItemAttributes {
  id: number;
  order_id: number;
  wristband_color_id: number;
  quantity: number;
}

interface WristbandOrderItemCreationAttributes extends Optional<WristbandOrderItemAttributes, 'id'> {}

class WristbandOrderItem extends Model<WristbandOrderItemAttributes, WristbandOrderItemCreationAttributes> implements WristbandOrderItemAttributes {
  public id!: number;
  public order_id!: number;
  public wristband_color_id!: number;
  public quantity!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

WristbandOrderItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    wristband_color_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'wristband_order_item',
    timestamps: true,
    underscored: true,
  }
);

export default WristbandOrderItem;
