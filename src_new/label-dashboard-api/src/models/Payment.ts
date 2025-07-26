import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PaymentAttributes {
  id: number;
  description?: string;
  amount: number;
  artist_id: number;
  date_paid: Date;
  paid_thru_type?: string;
  paid_thru_account_name?: string;
  paid_thru_account_number?: string;
  payment_method_id?: number;
  reference_number?: string;
  payment_processing_fee?: number;
}

interface PaymentCreationAttributes extends Optional<PaymentAttributes, 'id'> {}

class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
  public id!: number;
  public description?: string;
  public amount!: number;
  public artist_id!: number;
  public date_paid!: Date;
  public paid_thru_type?: string;
  public paid_thru_account_name?: string;
  public paid_thru_account_number?: string;
  public payment_method_id?: number;
  public reference_number?: string;
  public payment_processing_fee?: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Payment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    description: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    artist_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    date_paid: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    paid_thru_type: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    paid_thru_account_name: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    paid_thru_account_number: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    payment_method_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reference_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    payment_processing_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'payment',
    timestamps: false,
  }
);

export default Payment;