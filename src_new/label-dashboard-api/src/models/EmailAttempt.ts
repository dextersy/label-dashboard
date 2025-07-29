import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface EmailAttemptAttributes {
  id: number;
  recipients: string;
  subject: string;
  body: string;
  timestamp: Date;
  result: string;
  brand_id: number;
}

interface EmailAttemptCreationAttributes extends Optional<EmailAttemptAttributes, 'id' | 'timestamp'> {}

class EmailAttempt extends Model<EmailAttemptAttributes, EmailAttemptCreationAttributes> 
  implements EmailAttemptAttributes {
  public id!: number;
  public recipients!: string;
  public subject!: string;
  public body!: string;
  public timestamp!: Date;
  public result!: string;
  public brand_id!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EmailAttempt.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    recipients: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Comma-separated list of email recipients',
    },
    subject: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    result: {
      type: DataTypes.ENUM('Success', 'Failed'),
      allowNull: false,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'brands',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    modelName: 'EmailAttempt',
    tableName: 'email_attempt',
    timestamps: false, // Using custom timestamp field
    indexes: [
      {
        fields: ['brand_id'],
      },
      {
        fields: ['timestamp'],
      },
      {
        fields: ['result'],
      },
    ],
  }
);

export default EmailAttempt;