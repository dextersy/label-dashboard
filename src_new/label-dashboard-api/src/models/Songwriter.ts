import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface SongwriterAttributes {
  id: number;
  name: string;
  pro_affiliation?: string;
  ipi_number?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SongwriterCreationAttributes extends Optional<SongwriterAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class Songwriter extends Model<SongwriterAttributes, SongwriterCreationAttributes> implements SongwriterAttributes {
  public id!: number;
  public name!: string;
  public pro_affiliation?: string;
  public ipi_number?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Songwriter.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    pro_affiliation: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ipi_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'songwriter',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['name', 'pro_affiliation', 'ipi_number'],
        name: 'unique_songwriter'
      }
    ]
  }
);

export default Songwriter;
