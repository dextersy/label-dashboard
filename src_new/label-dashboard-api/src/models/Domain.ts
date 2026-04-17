import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import Brand from './Brand';

type DomainStatus = 'Unverified' | 'Pending' | 'No SSL' | 'Connected';

interface DomainAttributes {
  brand_id: number;
  domain_name: string;
  status: DomainStatus;
  is_primary: boolean;
}

interface DomainCreationAttributes extends Optional<DomainAttributes, 'status' | 'is_primary'> {}

class Domain extends Model<DomainAttributes, DomainCreationAttributes> implements DomainAttributes {
  public brand_id!: number;
  public domain_name!: string;
  public status!: DomainStatus;
  public is_primary!: boolean;

  // Association properties
  public brand?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Domain.init(
  {
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    domain_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      primaryKey: true,
    },
    status: {
      type: DataTypes.ENUM('Unverified', 'Pending', 'No SSL', 'Connected'),
      allowNull: true,
      defaultValue: 'Unverified',
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'domain',
    timestamps: false,
  }
);


export default Domain;