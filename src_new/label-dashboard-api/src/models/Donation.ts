import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

type DonationStatus = 'pending' | 'paid' | 'failed' | 'refunded';

interface DonationAttributes {
  id: number;
  fundraiser_id: number;
  name: string;
  email: string;
  contact_number?: string;
  amount: number;
  payment_status: DonationStatus;
  processing_fee?: number;
  platform_fee?: number;
  payment_reference?: string;
  checkout_key?: string;
  payment_id?: string;
  anonymous: boolean;
  order_timestamp?: Date;
  date_paid?: Date;
}

interface DonationCreationAttributes extends Optional<DonationAttributes, 'id' | 'payment_status' | 'anonymous'> {}

class Donation extends Model<DonationAttributes, DonationCreationAttributes> implements DonationAttributes {
  public id!: number;
  public fundraiser_id!: number;
  public name!: string;
  public email!: string;
  public contact_number?: string;
  public amount!: number;
  public payment_status!: DonationStatus;
  public processing_fee?: number;
  public platform_fee?: number;
  public payment_reference?: string;
  public checkout_key?: string;
  public payment_id?: string;
  public anonymous!: boolean;
  public order_timestamp?: Date;
  public date_paid?: Date;

  // Association properties
  public fundraiser?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Donation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fundraiser_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    contact_number: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        const value = this.getDataValue('amount');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
      set(value: any) {
        this.setDataValue('amount', value !== null && value !== undefined ? parseFloat(value) : value);
      }
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
    },
    processing_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        const value = this.getDataValue('processing_fee');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
      set(value: any) {
        this.setDataValue('processing_fee', value !== null && value !== undefined ? parseFloat(value) : value);
      }
    },
    platform_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        const value = this.getDataValue('platform_fee');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
      set(value: any) {
        this.setDataValue('platform_fee', value !== null && value !== undefined ? parseFloat(value) : value);
      }
    },
    payment_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    checkout_key: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    payment_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    anonymous: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    order_timestamp: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    date_paid: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'donation',
    timestamps: true,
  }
);

export default Donation;
