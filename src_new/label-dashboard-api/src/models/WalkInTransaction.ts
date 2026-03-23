import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface WalkInTransactionAttributes {
  id: number;
  event_id: number;
  payment_method: 'cash' | 'gcash' | 'card';
  payment_reference?: string;
  total_amount: number;
  registered_by: number;
}

interface WalkInTransactionCreationAttributes extends Optional<WalkInTransactionAttributes, 'id'> {}

class WalkInTransaction extends Model<WalkInTransactionAttributes, WalkInTransactionCreationAttributes> implements WalkInTransactionAttributes {
  public id!: number;
  public event_id!: number;
  public payment_method!: 'cash' | 'gcash' | 'card';
  public payment_reference?: string;
  public total_amount!: number;
  public registered_by!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public event?: any;
  public registeredByUser?: any;
  public items?: any[];
}

WalkInTransaction.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    payment_method: {
      type: DataTypes.ENUM('cash', 'gcash', 'card'),
      allowNull: false,
    },
    payment_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        const value = this.getDataValue('total_amount');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
      set(value: any) {
        this.setDataValue('total_amount', value !== null && value !== undefined ? parseFloat(value) : value);
      }
    },
    registered_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'walk_in_transaction',
    timestamps: true,
  }
);

export default WalkInTransaction;
