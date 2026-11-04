import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type WristbandOrderStatus = 'draft' | 'placed' | 'rejected' | 'confirmed' | 'shipped';

interface WristbandOrderAttributes {
  id: number;
  event_id: number;
  status: WristbandOrderStatus;
  design_url: string | null;
  design_x: number | null;
  design_y: number | null;
  design_width: number | null;
  design_height: number | null;
  canvas_width: number | null;
  disclaimer_acknowledged: boolean;
  notes: string | null;
  shipping_fee: number | null;
  discount: number | null;
  tracking_url: string | null;
  created_by: number | null;
  is_public: boolean;
  public_token: string | null;
  customer_name: string | null;
  customer_email: string | null;
}

interface WristbandOrderCreationAttributes extends Optional<WristbandOrderAttributes, 'id' | 'design_url' | 'design_x' | 'design_y' | 'design_width' | 'design_height' | 'canvas_width' | 'notes' | 'disclaimer_acknowledged' | 'shipping_fee' | 'discount' | 'tracking_url' | 'created_by' | 'is_public' | 'public_token' | 'customer_name' | 'customer_email'> {}

class WristbandOrder extends Model<WristbandOrderAttributes, WristbandOrderCreationAttributes> implements WristbandOrderAttributes {
  public id!: number;
  public event_id!: number;
  public status!: WristbandOrderStatus;
  public design_url!: string | null;
  public design_x!: number | null;
  public design_y!: number | null;
  public design_width!: number | null;
  public design_height!: number | null;
  public canvas_width!: number | null;
  public disclaimer_acknowledged!: boolean;
  public notes!: string | null;
  public shipping_fee!: number | null;
  public discount!: number | null;
  public tracking_url!: string | null;
  public created_by!: number | null;
  public is_public!: boolean;
  public public_token!: string | null;
  public customer_name!: string | null;
  public customer_email!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

WristbandOrder.init(
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
    status: {
      type: DataTypes.ENUM('draft', 'placed', 'rejected', 'confirmed', 'shipped'),
      allowNull: false,
      defaultValue: 'draft',
    },
    design_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    design_x: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    design_y: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    design_width: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    design_height: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    canvas_width: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    disclaimer_acknowledged: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    shipping_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    discount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    tracking_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    public_token: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: true,
    },
    customer_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    customer_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'wristband_order',
    timestamps: true,
    underscored: true,
  }
);

export default WristbandOrder;
