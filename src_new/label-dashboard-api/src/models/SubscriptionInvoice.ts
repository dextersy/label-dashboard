import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import Plan from './Plan';

export type InvoiceStatus = 'open' | 'paid' | 'void' | 'uncollectible';
export type BillingReason =
  | 'subscription_create'
  | 'subscription_cycle'
  | 'subscription_update';

interface SubscriptionInvoiceAttributes {
  id: number;
  brand_id: number;
  plan_id: number;
  billing_cycle: 'monthly' | 'annual';
  /** Human-readable invoice number, e.g. INV-0001 */
  invoice_number: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  billing_reason: BillingReason;
  period_start: Date;
  period_end: Date | null;
  /** The PayPal subscription ID this invoice is for */
  paypal_subscription_id: string | null;
  paid_at: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type SubscriptionInvoiceCreationAttributes = Optional<
  SubscriptionInvoiceAttributes,
  'id' | 'period_end' | 'paypal_subscription_id' | 'paid_at'
>;

class SubscriptionInvoice
  extends Model<SubscriptionInvoiceAttributes, SubscriptionInvoiceCreationAttributes>
  implements SubscriptionInvoiceAttributes
{
  declare id: number;
  declare brand_id: number;
  declare plan_id: number;
  declare billing_cycle: 'monthly' | 'annual';
  declare invoice_number: string;
  declare amount: number;
  declare currency: string;
  declare status: InvoiceStatus;
  declare billing_reason: BillingReason;
  declare period_start: Date;
  declare period_end: Date | null;
  declare paypal_subscription_id: string | null;
  declare paid_at: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

SubscriptionInvoice.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    brand_id: { type: DataTypes.INTEGER, allowNull: false },
    plan_id: { type: DataTypes.INTEGER, allowNull: false },
    billing_cycle: { type: DataTypes.ENUM('monthly', 'annual'), allowNull: false },
    invoice_number: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'PHP' },
    status: {
      type: DataTypes.ENUM('open', 'paid', 'void', 'uncollectible'),
      allowNull: false,
      defaultValue: 'open',
    },
    billing_reason: {
      type: DataTypes.ENUM('subscription_create', 'subscription_cycle', 'subscription_update'),
      allowNull: false,
    },
    period_start: { type: DataTypes.DATE, allowNull: false },
    period_end: { type: DataTypes.DATE, allowNull: true },
    paypal_subscription_id: { type: DataTypes.STRING(64), allowNull: true },
    paid_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'subscription_invoices',
    timestamps: true,
  }
);

SubscriptionInvoice.belongsTo(Plan, { foreignKey: 'plan_id', as: 'plan' });

export default SubscriptionInvoice;
