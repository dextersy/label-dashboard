import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface EventAddOnPaymentAttributes {
  id: number;
  event_id: number;
  amount: number;
  method: 'balance' | 'paymongo';
  status: 'pending' | 'succeeded' | 'failed';
  reference_number?: string;
  checkout_key?: string;
  checkout_session_id?: string;
  notes?: string;
  created_by: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface EventAddOnPaymentCreationAttributes extends Optional<EventAddOnPaymentAttributes, 'id'> {}

class EventAddOnPayment extends Model<EventAddOnPaymentAttributes, EventAddOnPaymentCreationAttributes> implements EventAddOnPaymentAttributes {
  public id!: number;
  public event_id!: number;
  public amount!: number;
  public method!: 'balance' | 'paymongo';
  public status!: 'pending' | 'succeeded' | 'failed';
  public reference_number?: string;
  public checkout_key?: string;
  public checkout_session_id?: string;
  public notes?: string;
  public created_by!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EventAddOnPayment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'event', key: 'id' },
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    method: {
      type: DataTypes.ENUM('balance', 'paymongo'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'succeeded', 'failed'),
      allowNull: false,
      defaultValue: 'succeeded',
    },
    reference_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    checkout_key: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    checkout_session_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'user', key: 'id' },
    },
  },
  {
    sequelize,
    tableName: 'event_addon_payment',
    timestamps: true,
  }
);

export default EventAddOnPayment;
