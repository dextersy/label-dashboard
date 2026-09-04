import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface AudienceUserAttributes {
  id: number;
  email_address: string;
  password_hash?: string;
  first_name?: string;
  last_name?: string;
  contact_number?: string;
  profile_photo_url?: string;
  membership_id?: string;

  reset_hash?: string;
  reset_hash_expires_at?: Date;
  email_verified?: boolean;
  email_verification_token?: string;
  email_verification_expires_at?: Date;
  terms_accepted_at?: Date;
  privacy_accepted_at?: Date;
  age_confirmed_at?: Date;
  signed_up_from?: string | null;
  signup_reference?: string | null;
  oauth_exchange_code?: string | null;
  oauth_exchange_code_expires_at?: Date | null;
  points_total?: number;
  referral_code?: string | null;
  referred_by_user_id?: number | null;
}

interface AudienceUserCreationAttributes extends Optional<AudienceUserAttributes, 'id'> {}

class AudienceUser extends Model<AudienceUserAttributes, AudienceUserCreationAttributes> implements AudienceUserAttributes {
  public id!: number;
  public email_address!: string;
  public password_hash?: string;
  public first_name?: string;
  public last_name?: string;
  public contact_number?: string;
  public profile_photo_url?: string;
  public membership_id?: string;
  public membership_tier?: string;
  public reset_hash?: string;
  public reset_hash_expires_at?: Date;
  public email_verified?: boolean;
  public email_verification_token?: string;
  public email_verification_expires_at?: Date;
  public terms_accepted_at?: Date;
  public privacy_accepted_at?: Date;
  public age_confirmed_at?: Date;
  public signed_up_from?: string | null;
  public signup_reference?: string | null;
  public oauth_exchange_code?: string | null;
  public oauth_exchange_code_expires_at?: Date | null;
  public points_total?: number;
  public referral_code?: string | null;
  public referred_by_user_id?: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AudienceUser.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    contact_number: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    profile_photo_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    membership_id: {
      type: DataTypes.STRING(12),
      allowNull: true,
      unique: true,
    },
    reset_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reset_hash_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    email_verification_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    email_verification_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    terms_accepted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    privacy_accepted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    age_confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    signed_up_from: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    signup_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    oauth_exchange_code: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    oauth_exchange_code_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    points_total: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    referral_code: {
      type: DataTypes.STRING(10),
      allowNull: true,
      unique: true,
    },
    referred_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'audience_user',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default AudienceUser;
