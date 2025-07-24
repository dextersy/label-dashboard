import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

type AccessStatus = 'Pending' | 'Accepted';

interface ArtistAccessAttributes {
  artist_id: number;
  user_id: number;
  can_view_payments: boolean;
  can_view_royalties: boolean;
  can_edit_artist_profile: boolean;
  status: AccessStatus;
  invite_hash?: string;
}

interface ArtistAccessCreationAttributes extends Optional<ArtistAccessAttributes, 
  'can_view_payments' | 'can_view_royalties' | 'can_edit_artist_profile' | 'status'> {}

class ArtistAccess extends Model<ArtistAccessAttributes, ArtistAccessCreationAttributes> implements ArtistAccessAttributes {
  public artist_id!: number;
  public user_id!: number;
  public can_view_payments!: boolean;
  public can_view_royalties!: boolean;
  public can_edit_artist_profile!: boolean;
  public status!: AccessStatus;
  public invite_hash?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ArtistAccess.init(
  {
    artist_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    can_view_payments: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1,
    },
    can_view_royalties: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1,
    },
    can_edit_artist_profile: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1,
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Accepted'),
      allowNull: false,
      defaultValue: 'Pending',
    },
    invite_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'artist_access',
    timestamps: false,
  }
);

export default ArtistAccess;