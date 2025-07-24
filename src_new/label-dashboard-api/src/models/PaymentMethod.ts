import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PaymentMethodAttributes {
  id: number;
  artist_id: number;
  type: string;
  account_name: string;
  account_number_or_email: string;
  is_default_for_artist: boolean;
  bank_code: string;
}

interface PaymentMethodCreationAttributes extends Optional<PaymentMethodAttributes, 'id' | 'is_default_for_artist' | 'bank_code'> {}

class PaymentMethod extends Model<PaymentMethodAttributes, PaymentMethodCreationAttributes> implements PaymentMethodAttributes {
  public id!: number;
  public artist_id!: number;
  public type!: string;
  public account_name!: string;
  public account_number_or_email!: string;
  public is_default_for_artist!: boolean;
  public bank_code!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PaymentMethod.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    artist_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    account_name: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    account_number_or_email: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    is_default_for_artist: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
    },
    bank_code: {
      type: DataTypes.STRING(45),
      allowNull: false,
      defaultValue: 'N/A',
    },
  },
  {
    sequelize,
    tableName: 'payment_method',
    timestamps: false,
  }
);

export default PaymentMethod;