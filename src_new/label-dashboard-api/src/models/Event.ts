import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface EventAttributes {
  id: number;
  brand_id: number;
  title: string;
  date_and_time: Date;
  venue: string;
  description?: string;
  poster_url?: string;
  rsvp_link?: string;
  ticket_price: number | null;
  buy_shortlink?: string;
  close_time?: Date;
  verification_pin: string;
  verification_link: string;
  supports_gcash: boolean;
  supports_qrph: boolean;
  supports_card: boolean;
  supports_ubp: boolean;
  supports_dob: boolean;
  supports_maya: boolean;
  supports_grabpay: boolean;
  max_tickets?: number;
  ticket_naming: string;
  countdown_display: 'always' | '1_week' | '3_days' | '1_day' | 'never';
  show_tickets_remaining: boolean;
  google_place_id?: string;
  venue_address?: string;
  venue_latitude?: number;
  venue_longitude?: number;
  venue_phone?: string;
  venue_website?: string;
  venue_maps_url?: string;
  status: 'draft' | 'published';
  event_type?: 'concert' | 'festival' | 'club_night' | 'open_mic' | 'dj_set' | 'listening_party' | 'album_launch' | 'workshop' | 'meetup' | 'other' | null;
  ticketing_enabled: boolean;
  external_ticket_link?: string | null;
  listed_on_ticketing: boolean;
  show_attendee_count: boolean;
  walk_in_enabled: boolean;
  walk_in_supports_cash: boolean;
  walk_in_supports_gcash: boolean;
  walk_in_supports_card: boolean;
  walk_in_max_count: number;
}

interface EventCreationAttributes extends Optional<EventAttributes, 'id'> {}

class Event extends Model<EventAttributes, EventCreationAttributes> implements EventAttributes {
  public id!: number;
  public brand_id!: number;
  public title!: string;
  public date_and_time!: Date;
  public venue!: string;
  public description?: string;
  public poster_url?: string;
  public rsvp_link?: string;
  public ticket_price!: number | null;
  public buy_shortlink?: string;
  public close_time?: Date;
  public verification_pin!: string;
  public verification_link!: string;
  public supports_gcash!: boolean;
  public supports_qrph!: boolean;
  public supports_card!: boolean;
  public supports_ubp!: boolean;
  public supports_dob!: boolean;
  public supports_maya!: boolean;
  public supports_grabpay!: boolean;
  public max_tickets?: number;
  public ticket_naming!: string;
  public countdown_display!: 'always' | '1_week' | '3_days' | '1_day' | 'never';
  public show_tickets_remaining!: boolean;
  public google_place_id?: string;
  public venue_address?: string;
  public venue_latitude?: number;
  public venue_longitude?: number;
  public venue_phone?: string;
  public venue_website?: string;
  public venue_maps_url?: string;
  public status!: 'draft' | 'published';
  public event_type?: 'concert' | 'festival' | 'club_night' | 'open_mic' | 'dj_set' | 'listening_party' | 'album_launch' | 'workshop' | 'meetup' | 'other' | null;
  public ticketing_enabled!: boolean;
  public external_ticket_link?: string | null;
  public listed_on_ticketing!: boolean;
  public show_attendee_count!: boolean;
  public walk_in_enabled!: boolean;
  public walk_in_supports_cash!: boolean;
  public walk_in_supports_gcash!: boolean;
  public walk_in_supports_card!: boolean;
  public walk_in_max_count!: number;

  // Association properties
  public brand?: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Event.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    date_and_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    venue: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    poster_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    rsvp_link: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ticket_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        // Force conversion to number when reading from database
        const value = this.getDataValue('ticket_price');
        return value !== null && value !== undefined ? parseFloat(String(value)) : value;
      },
      set(value: any) {
        // Force conversion to number when writing to database
        this.setDataValue('ticket_price', value !== null && value !== undefined ? parseFloat(value) : value);
      }
    },
    buy_shortlink: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
    close_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verification_pin: {
      type: DataTypes.STRING(6),
      allowNull: false,
    },
    verification_link: {
      type: DataTypes.STRING(1024),
      allowNull: false,
    },
    supports_gcash: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    supports_qrph: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    supports_card: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    supports_ubp: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    supports_dob: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    supports_maya: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    supports_grabpay: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    max_tickets: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    ticket_naming: {
      type: DataTypes.STRING(45),
      allowNull: false,
      defaultValue: 'Regular',
    },
    countdown_display: {
      type: DataTypes.ENUM('always', '1_week', '3_days', '1_day', 'never'),
      allowNull: false,
      defaultValue: '1_week',
    },
    show_tickets_remaining: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    google_place_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    venue_address: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    venue_latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    venue_longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
    venue_phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    venue_website: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    venue_maps_url: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'published'),
      allowNull: false,
      defaultValue: 'draft',
    },
    event_type: {
      type: DataTypes.ENUM(
        'concert', 'festival', 'club_night', 'open_mic', 'dj_set',
        'listening_party', 'album_launch', 'workshop', 'meetup', 'other'
      ),
      allowNull: true,
      defaultValue: null,
    },
    ticketing_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    external_ticket_link: {
      type: DataTypes.STRING(1024),
      allowNull: true,
      defaultValue: null,
    },
    listed_on_ticketing: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    show_attendee_count: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    walk_in_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    walk_in_supports_cash: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    walk_in_supports_gcash: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    walk_in_supports_card: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    walk_in_max_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'event',
    timestamps: false,
  }
);

export default Event;