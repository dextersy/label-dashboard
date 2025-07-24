import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import Brand from './Brand';

type DomainStatus = 'Verified' | 'Unverified' | 'Pending';

interface DomainAttributes {
  brand_id: number;
  domain_name: string;
  status: DomainStatus;
}

interface DomainCreationAttributes extends Optional<DomainAttributes, 'status'> {}

class Domain extends Model<DomainAttributes, DomainCreationAttributes> implements DomainAttributes {
  public brand_id!: number;
  public domain_name!: string;
  public status!: DomainStatus;

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
      type: DataTypes.ENUM('Verified', 'Unverified', 'Pending'),
      allowNull: true,
      defaultValue: 'Unverified',
    },
  },
  {
    sequelize,
    tableName: 'domain',
    timestamps: false,
  }
);


export default Domain;