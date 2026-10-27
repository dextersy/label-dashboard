import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface TicketScanLogAttributes {
  id: number;
  ticket_id: number;
  event_day_id: number;
  entries_claimed: number;
  scanned_at: Date;
}

interface TicketScanLogCreationAttributes extends Optional<TicketScanLogAttributes, 'id' | 'scanned_at'> {}

class TicketScanLog extends Model<TicketScanLogAttributes, TicketScanLogCreationAttributes> implements TicketScanLogAttributes {
  public id!: number;
  public ticket_id!: number;
  public event_day_id!: number;
  public entries_claimed!: number;
  public scanned_at!: Date;
}

TicketScanLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ticket_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    event_day_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    entries_claimed: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    scanned_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'ticket_scan_log',
    timestamps: false,
  }
);

export default TicketScanLog;
