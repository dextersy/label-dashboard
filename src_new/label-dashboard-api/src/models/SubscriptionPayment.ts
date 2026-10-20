import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import SubscriptionInvoice from './SubscriptionInvoice';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed';

interface SubscriptionPaymentAttributes {
  id: number;
  brand_id: number;
  invoice_id: number;
  amount: number;
  currency: string;
  status: PaymentStatus;
  /** Payment processor used, e.g. 'paypal' */
  payment_method: string;
  /** PayPal sale/capture transaction ID */
  paypal_transaction_id: string | null;
  /** The PayPal subscription ID this payment is for */
  paypal_subscription_id: string | null;
  failure_reason: string | null;
  processed_at: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type SubscriptionPaymentCreationAttributes = Optional<
  SubscriptionPaymentAttributes,
  'id' | 'paypal_transaction_id' | 'paypal_subscription_id' | 'failure_reason' | 'processed_at'
>;

class SubscriptionPayment
  extends Model<SubscriptionPaymentAttributes, SubscriptionPaymentCreationAttributes>
  implements SubscriptionPaymentAttributes
{
  declare id: number;
  declare brand_id: number;
  declare invoice_id: number;
  declare amount: number;
  declare currency: string;
  declare status: PaymentStatus;
  declare payment_method: string;
  declare paypal_transaction_id: string | null;
  declare paypal_subscription_id: string | null;
  declare failure_reason: string | null;
  declare processed_at: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

SubscriptionPayment.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    brand_id: { type: DataTypes.INTEGER, allowNull: false },
    invoice_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'subscription_invoices', key: 'id' },
    },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'PHP' },
    status: {
      type: DataTypes.ENUM('pending', 'succeeded', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    payment_method: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'paypal' },
    paypal_transaction_id: { type: DataTypes.STRING(64), allowNull: true },
    paypal_subscription_id: { type: DataTypes.STRING(64), allowNull: true },
    failure_reason: { type: DataTypes.STRING(255), allowNull: true },
    processed_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'subscription_payments',
    timestamps: true,
  }
);

SubscriptionPayment.belongsTo(SubscriptionInvoice, { foreignKey: 'invoice_id', as: 'invoice' });
SubscriptionInvoice.hasMany(SubscriptionPayment, { foreignKey: 'invoice_id', as: 'payments' });

export default SubscriptionPayment;
