import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface WalkInTransactionItemAttributes {
  id: number;
  walk_in_transaction_id: number;
  walk_in_type_id: number;
  quantity: number;
  price_per_unit: number;
}

interface WalkInTransactionItemCreationAttributes extends Optional<WalkInTransactionItemAttributes, 'id'> {}

class WalkInTransactionItem extends Model<WalkInTransactionItemAttributes, WalkInTransactionItemCreationAttributes> implements WalkInTransactionItemAttributes {
  public id!: number;
  public walk_in_transaction_id!: number;
  public walk_in_type_id!: number;
  public quantity!: number;
  public price_per_unit!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public transaction?: any;
  public walkInType?: any;
}

WalkInTransactionItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    walk_in_transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    walk_in_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    price_per_unit: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        const value = this.getDataValue('price_per_unit');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
      set(value: any) {
        this.setDataValue('price_per_unit', value !== null && value !== undefined ? parseFloat(value) : value);
      }
    },
  },
  {
    sequelize,
    tableName: 'walk_in_transaction_item',
    timestamps: true,
  }
);

export default WalkInTransactionItem;
