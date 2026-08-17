import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PlanAttributes {
  id: number;
  name: string;
  price_monthly: number;
  price_annual: number;

  // Limits — NULL means unlimited
  limit_artists?: number | null;
  limit_releases_per_artist?: number | null;
  limit_press_campaigns_per_month?: number | null;
  limit_sync_pitches_per_month?: number | null;
  limit_storage_gb?: number | null;
  limit_admin_users?: number | null;

  // Default processing fees (can be overridden per brand in Brand model fields)
  default_event_transaction_fixed_fee?: number;
  default_event_revenue_percentage_fee?: number;
  default_event_fee_revenue_type?: 'net' | 'gross';
  default_fundraiser_transaction_fixed_fee?: number;
  default_fundraiser_revenue_percentage_fee?: number;
  default_fundraiser_fee_revenue_type?: 'net' | 'gross';

  // Feature flags
  feature_music_workspace: boolean;
  feature_campaigns_workspace: boolean;
  feature_sublabels: boolean;
  feature_artist_profiles: boolean;
  feature_music_releases: boolean;
  feature_press_campaigns: boolean;
  feature_sync_licensing: boolean;
  feature_events: boolean;
  feature_fundraisers: boolean;

  is_active: boolean;
  is_public: boolean;
  is_default_free: boolean;
  sort_order: number;

  // PayMongo plan IDs (created lazily on first subscription for that billing cycle)
  paymongo_plan_id_monthly?: string | null;
  paymongo_plan_id_annual?: string | null;
}

interface PlanCreationAttributes extends Optional<PlanAttributes, 'id' | 'sort_order'> {}

class Plan extends Model<PlanAttributes, PlanCreationAttributes> implements PlanAttributes {
  public id!: number;
  public name!: string;
  public price_monthly!: number;
  public price_annual!: number;

  public limit_artists?: number | null;
  public limit_releases_per_artist?: number | null;
  public limit_press_campaigns_per_month?: number | null;
  public limit_sync_pitches_per_month?: number | null;
  public limit_storage_gb?: number | null;
  public limit_admin_users?: number | null;

  public default_event_transaction_fixed_fee?: number;
  public default_event_revenue_percentage_fee?: number;
  public default_event_fee_revenue_type?: 'net' | 'gross';
  public default_fundraiser_transaction_fixed_fee?: number;
  public default_fundraiser_revenue_percentage_fee?: number;
  public default_fundraiser_fee_revenue_type?: 'net' | 'gross';

  public feature_music_workspace!: boolean;
  public feature_campaigns_workspace!: boolean;
  public feature_sublabels!: boolean;
  public feature_artist_profiles!: boolean;
  public feature_music_releases!: boolean;
  public feature_press_campaigns!: boolean;
  public feature_sync_licensing!: boolean;
  public feature_events!: boolean;
  public feature_fundraisers!: boolean;

  public is_active!: boolean;
  public is_public!: boolean;
  public is_default_free!: boolean;
  public sort_order!: number;
  public paymongo_plan_id_monthly?: string | null;
  public paymongo_plan_id_annual?: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Plan.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    price_monthly: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      get() {
        const value = this.getDataValue('price_monthly');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
    },
    price_annual: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      get() {
        const value = this.getDataValue('price_annual');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
    },

    // Limits
    limit_artists: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    limit_releases_per_artist: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    limit_press_campaigns_per_month: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    limit_sync_pitches_per_month: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    limit_storage_gb: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        const value = this.getDataValue('limit_storage_gb');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
    },
    limit_admin_users: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // Default fees
    default_event_transaction_fixed_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      get() {
        const value = this.getDataValue('default_event_transaction_fixed_fee');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
    },
    default_event_revenue_percentage_fee: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
      get() {
        const value = this.getDataValue('default_event_revenue_percentage_fee');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
    },
    default_event_fee_revenue_type: {
      type: DataTypes.ENUM('net', 'gross'),
      allowNull: true,
      defaultValue: 'net',
    },
    default_fundraiser_transaction_fixed_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      get() {
        const value = this.getDataValue('default_fundraiser_transaction_fixed_fee');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
    },
    default_fundraiser_revenue_percentage_fee: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
      get() {
        const value = this.getDataValue('default_fundraiser_revenue_percentage_fee');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
    },
    default_fundraiser_fee_revenue_type: {
      type: DataTypes.ENUM('net', 'gross'),
      allowNull: true,
      defaultValue: 'net',
    },

    // Feature flags
    feature_music_workspace: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    feature_campaigns_workspace: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    feature_sublabels: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    feature_artist_profiles: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    feature_music_releases: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    feature_press_campaigns: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    feature_sync_licensing: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    feature_events: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    feature_fundraisers: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_default_free: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    paymongo_plan_id_monthly: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    paymongo_plan_id_annual: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'plan',
    timestamps: true,
  }
);

export default Plan;
