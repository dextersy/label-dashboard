import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type WristbandOrderStatus = 'draft' | 'placed' | 'rejected' | 'confirmed';

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
  created_by: number;
}

interface WristbandOrderCreationAttributes extends Optional<WristbandOrderAttributes, 'id' | 'design_url' | 'design_x' | 'design_y' | 'design_width' | 'design_height' | 'canvas_width' | 'notes' | 'disclaimer_acknowledged'> {}

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
  public created_by!: number;

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
      type: DataTypes.ENUM('draft', 'placed', 'rejected', 'confirmed'),
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
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
