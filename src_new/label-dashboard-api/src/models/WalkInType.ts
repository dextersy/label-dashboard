import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface WalkInTypeAttributes {
  id: number;
  event_id: number;
  name: string;
  price: number;
  max_slots: number;
}

interface WalkInTypeCreationAttributes extends Optional<WalkInTypeAttributes, 'id'> {}

class WalkInType extends Model<WalkInTypeAttributes, WalkInTypeCreationAttributes> implements WalkInTypeAttributes {
  public id!: number;
  public event_id!: number;
  public name!: string;
  public price!: number;
  public max_slots!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public event?: any;
  public transactionItems?: any[];

  public async getSoldCount(): Promise<number> {
    const { WalkInTransactionItem } = require('./');
    const result = await WalkInTransactionItem.sum('quantity', {
      where: { walk_in_type_id: this.id }
    });
    return result || 0;
  }

  public async getRemainingSlots(): Promise<number | null> {
    if (this.max_slots === 0) {
      return null; // unlimited
    }
    const soldCount = await this.getSoldCount();
    return Math.max(0, this.max_slots - soldCount);
  }
}

WalkInType.init(
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
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      get() {
        const value = this.getDataValue('price');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
      set(value: any) {
        this.setDataValue('price', value !== null && value !== undefined ? parseFloat(value) : value);
      }
    },
    max_slots: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'walk_in_type',
    timestamps: true,
  }
);

export default WalkInType;
