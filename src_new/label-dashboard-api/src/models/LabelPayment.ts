import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface LabelPaymentAttributes {
  id: number;
  description?: string;
  amount: number;
  brand_id: number;
  date_paid: Date;
  paid_thru_type?: string;
  paid_thru_account_name?: string;
  paid_thru_account_number?: string;
  payment_method_id?: number;
  reference_number?: string;
  payment_processing_fee?: number;
}

interface LabelPaymentCreationAttributes extends Optional<LabelPaymentAttributes, 'id'> {}

class LabelPayment extends Model<LabelPaymentAttributes, LabelPaymentCreationAttributes> implements LabelPaymentAttributes {
  public id!: number;
  public description?: string;
  public amount!: number;
  public brand_id!: number;
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

LabelPayment.init(
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
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'brand',
        key: 'id'
      }
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
      references: {
        model: 'label_payment_method',
        key: 'id'
      }
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
    tableName: 'label_payment',
    timestamps: false,
  }
);

export default LabelPayment;