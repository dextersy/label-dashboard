import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface RecuperableExpenseAttributes {
  id: number;
  release_id: number;
  expense_description: string;
  expense_amount: number;
  date_recorded?: Date;
  brand_id: number;
}

interface RecuperableExpenseCreationAttributes extends Optional<RecuperableExpenseAttributes, 'id'> {}

class RecuperableExpense extends Model<RecuperableExpenseAttributes, RecuperableExpenseCreationAttributes> implements RecuperableExpenseAttributes {
  public id!: number;
  public release_id!: number;
  public expense_description!: string;
  public expense_amount!: number;
  public date_recorded?: Date;
  public brand_id!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RecuperableExpense.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    release_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    expense_description: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    expense_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    date_recorded: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'recuperable_expense',
    timestamps: false,
  }
);

export default RecuperableExpense;