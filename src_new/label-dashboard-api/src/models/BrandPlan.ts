import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import Plan from './Plan';

interface BrandPlanAttributes {
  id: number;
  brand_id: number;
  plan_id: number;
  billing_cycle: 'monthly' | 'annual';
  started_at: Date;
  ends_at?: Date | null;

  // Per-brand limit overrides — NULL means "use the plan's value"
  override_limit_artists?: number | null;
  override_limit_releases_per_artist?: number | null;
  override_limit_press_campaigns_per_month?: number | null;
  override_limit_sync_pitches_per_month?: number | null;
  override_limit_storage_gb?: number | null;
  override_limit_admin_users?: number | null;

  // PayPal subscription tracking
  status: 'active' | 'incomplete' | 'past_due' | 'unpaid' | 'cancelled';
  paypal_subscription_id?: string | null;

  // Pending downgrade — set when a user requests a downgrade, cleared when activated
  pending_plan_id?: number | null;
  pending_billing_cycle?: 'monthly' | 'annual' | null;
  pending_paypal_subscription_id?: string | null;

  // Snapshot of status before it was set to 'incomplete' for a checkout attempt.
  // Used to restore the correct status if the user abandons the PayPal flow.
  pre_checkout_status?: 'active' | 'incomplete' | 'past_due' | 'unpaid' | 'cancelled' | null;
}

interface BrandPlanCreationAttributes extends Optional<BrandPlanAttributes, 'id'> {}

class BrandPlan extends Model<BrandPlanAttributes, BrandPlanCreationAttributes> implements BrandPlanAttributes {
  public id!: number;
  public brand_id!: number;
  public plan_id!: number;
  public billing_cycle!: 'monthly' | 'annual';
  public started_at!: Date;
  public ends_at?: Date | null;

  public override_limit_artists?: number | null;
  public override_limit_releases_per_artist?: number | null;
  public override_limit_press_campaigns_per_month?: number | null;
  public override_limit_sync_pitches_per_month?: number | null;
  public override_limit_storage_gb?: number | null;
  public override_limit_admin_users?: number | null;

  public status!: 'active' | 'incomplete' | 'past_due' | 'unpaid' | 'cancelled';
  public paypal_subscription_id?: string | null;

  public pending_plan_id?: number | null;
  public pending_billing_cycle?: 'monthly' | 'annual' | null;
  public pending_paypal_subscription_id?: string | null;
  public pre_checkout_status?: 'active' | 'incomplete' | 'past_due' | 'unpaid' | 'cancelled' | null;

  // Association properties
  public plan?: Plan;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BrandPlan.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'brand',
        key: 'id',
      },
    },
    plan_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'plan',
        key: 'id',
      },
    },
    billing_cycle: {
      type: DataTypes.ENUM('monthly', 'annual'),
      allowNull: false,
      defaultValue: 'monthly',
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Overrides
    override_limit_artists: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    override_limit_releases_per_artist: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    override_limit_press_campaigns_per_month: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    override_limit_sync_pitches_per_month: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    override_limit_storage_gb: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        const value = this.getDataValue('override_limit_storage_gb');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
    },
    override_limit_admin_users: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'incomplete', 'past_due', 'unpaid', 'cancelled'),
      allowNull: false,
      defaultValue: 'active',
    },
    paypal_subscription_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    pending_plan_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'plan',
        key: 'id',
      },
    },
    pending_billing_cycle: {
      type: DataTypes.ENUM('monthly', 'annual'),
      allowNull: true,
    },
    pending_paypal_subscription_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    pre_checkout_status: {
      type: DataTypes.ENUM('active', 'incomplete', 'past_due', 'unpaid', 'cancelled'),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'brand_plan',
    timestamps: true,
  }
);

export default BrandPlan;
