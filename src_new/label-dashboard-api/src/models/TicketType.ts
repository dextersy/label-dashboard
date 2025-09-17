import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface TicketTypeAttributes {
  id: number;
  event_id: number;
  name: string;
  price: number;
}

interface TicketTypeCreationAttributes extends Optional<TicketTypeAttributes, 'id'> {}

class TicketType extends Model<TicketTypeAttributes, TicketTypeCreationAttributes> implements TicketTypeAttributes {
  public id!: number;
  public event_id!: number;
  public name!: string;
  public price!: number;

  // Association properties
  public event?: any;
  public tickets?: any[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TicketType.init(
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
      get() {
        // Force conversion to number when reading from database
        const value = this.getDataValue('price');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
      set(value: any) {
        // Force conversion to number when writing to database
        this.setDataValue('price', value !== null && value !== undefined ? parseFloat(value) : value);
      }
    },
  },
  {
    sequelize,
    tableName: 'ticket_type',
    timestamps: true,
  }
);

export default TicketType;