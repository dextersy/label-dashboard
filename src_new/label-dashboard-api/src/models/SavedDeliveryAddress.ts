import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface SavedDeliveryAddressAttributes {
  id: number;
  user_id: number;
  label: string | null;
  name: string | null;
  street: string | null;
  city: string | null;
  country: string | null;
  zip: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface SavedDeliveryAddressCreationAttributes extends Optional<
  SavedDeliveryAddressAttributes,
  'id' | 'label' | 'name' | 'street' | 'city' | 'country' | 'zip' | 'phone' | 'latitude' | 'longitude'
> {}

class SavedDeliveryAddress extends Model<SavedDeliveryAddressAttributes, SavedDeliveryAddressCreationAttributes> implements SavedDeliveryAddressAttributes {
  public id!: number;
  public user_id!: number;
  public label!: string | null;
  public name!: string | null;
  public street!: string | null;
  public city!: string | null;
  public country!: string | null;
  public zip!: string | null;
  public phone!: string | null;
  public latitude!: number | null;
  public longitude!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SavedDeliveryAddress.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    street: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    zip: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'saved_delivery_address',
    timestamps: true,
    underscored: true,
  }
);

export default SavedDeliveryAddress;
