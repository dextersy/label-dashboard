/**
 * MySQL to PostgreSQL (Supabase) Data Migration Script
 *
 * Standalone script — does not import from the main app.
 * Reads from MySQL (read-only) and writes to Supabase PostgreSQL.
 * Idempotent: drops and recreates target tables on each run.
 *
 * Usage:
 *   MYSQL_HOST=... MYSQL_DB=... MYSQL_USER=... MYSQL_PASS=... \
 *   PG_HOST=... PG_DB=... PG_USER=... PG_PASS=... PG_PORT=... \
 *   npx ts-node scripts/migrate-mysql-to-postgres.ts
 *
 * Resume from a specific table (skips drop/create, truncates resume table, continues):
 *   RESUME_FROM=email_attempt npx ts-node scripts/migrate-mysql-to-postgres.ts
 */

// @ts-ignore
import mysql from 'mysql2/promise';
// @ts-ignore
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ── Config ──────────────────────────────────────────────────────────────────

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || process.env.DB_SERVER || 'localhost',
  database: process.env.MYSQL_DB || process.env.DB_DATABASE || 'meltrecords_dashboard',
  user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  password: process.env.MYSQL_PASS || process.env.DB_PASSWORD || '',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
};

// Supports either a connection string (DATABASE_URL / PG_URL) or individual params
const PG_CONNECTION_STRING = process.env.PG_URL || process.env.DATABASE_URL || '';

const PG_CONFIG: any = PG_CONNECTION_STRING
  ? {
      connectionString: PG_CONNECTION_STRING,
      ssl: process.env.PG_SSL === 'false' ? false : { rejectUnauthorized: false },
    }
  : {
      host: process.env.PG_HOST || 'localhost',
      database: process.env.PG_DB || 'postgres',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASS || '',
      port: parseInt(process.env.PG_PORT || '5432'),
      ssl: process.env.PG_SSL === 'false' ? false : { rejectUnauthorized: false },
    };

// ── ENUM definitions ────────────────────────────────────────────────────────

const ENUM_TYPES: Record<string, string[]> = {
  'enum_domain_status': ['Unverified', 'Pending', 'No SSL', 'Connected'],
  'enum_artist_access_status': ['Pending', 'Accepted'],
  'enum_release_status': ['Draft', 'For Submission', 'Pending', 'Live', 'Taken Down'],
  'enum_event_countdown_display': ['always', '1_week', '3_days', '1_day', 'never'],
  'enum_event_status': ['draft', 'published'],
  'enum_event_type': ['concert', 'festival', 'club_night', 'open_mic', 'dj_set', 'listening_party', 'album_launch', 'workshop', 'meetup', 'other'],
  'enum_ticket_status': ['New', 'Payment Confirmed', 'Ticket sent.', 'Canceled', 'Refunded'],
  'enum_login_attempt_status': ['Successful', 'Failed'],
  'enum_email_attempt_result': ['Success', 'Failed'],
  'enum_royalty_type': ['Revenue', 'Profit'],
  'enum_earning_type': ['Sync', 'Streaming', 'Downloads', 'Physical'],
  'enum_fee_revenue_type': ['net', 'gross'],
  'enum_fundraiser_status': ['draft', 'published', 'closed'],
  'enum_donation_payment_status': ['pending', 'paid', 'failed', 'refunded'],
  'enum_payment_status': ['pending', 'succeeded', 'failed'],
  'enum_walk_in_payment_method': ['cash', 'gcash', 'card'],
};

// ── Table schemas ───────────────────────────────────────────────────────────
// Each table: { columns, primaryKey, booleanColumns (for 0/1 → true/false conversion) }

interface TableDef {
  create: string;
  primaryKey?: string;          // for sequence reset (auto-increment column name)
  booleanColumns?: string[];    // columns that are TINYINT in MySQL → BOOLEAN in PG
  dateOnlyColumns?: string[];   // columns that may have '0000-00-00' → NULL
}

const TABLES: Record<string, TableDef> = {
  // ── Tier 1: No FK dependencies (or self-referencing) ──────────────────────
  brand: {
    create: `
      CREATE TABLE brand (
        id SERIAL PRIMARY KEY,
        brand_name VARCHAR(255) NOT NULL,
        logo_url VARCHAR(255),
        brand_color VARCHAR(45) NOT NULL DEFAULT '#ffffff',
        brand_website VARCHAR(255),
        favicon_url VARCHAR(255),
        paymongo_wallet_id VARCHAR(100),
        payment_processing_fee_for_payouts DECIMAL(10,2) DEFAULT 0,
        release_submission_url VARCHAR(500),
        catalog_prefix VARCHAR(10) DEFAULT 'REL',
        parent_brand INTEGER REFERENCES brand(id),
        monthly_fee DECIMAL(10,2) DEFAULT 0,
        music_transaction_fixed_fee DECIMAL(10,2) DEFAULT 0,
        music_revenue_percentage_fee DECIMAL(5,2) DEFAULT 0,
        music_fee_revenue_type enum_fee_revenue_type DEFAULT 'net',
        event_transaction_fixed_fee DECIMAL(10,2) DEFAULT 0,
        event_revenue_percentage_fee DECIMAL(5,2) DEFAULT 0,
        event_fee_revenue_type enum_fee_revenue_type DEFAULT 'net',
        fundraiser_transaction_fixed_fee DECIMAL(10,2) DEFAULT 0,
        fundraiser_revenue_percentage_fee DECIMAL(5,2) DEFAULT 0,
        fundraiser_fee_revenue_type enum_fee_revenue_type DEFAULT 'net',
        feature_music_workspace BOOLEAN NOT NULL DEFAULT TRUE,
        feature_campaigns_workspace BOOLEAN NOT NULL DEFAULT TRUE,
        feature_sublabels BOOLEAN NOT NULL DEFAULT TRUE
      )`,
    primaryKey: 'id',
    booleanColumns: ['feature_music_workspace', 'feature_campaigns_workspace', 'feature_sublabels'],
  },

  songwriter: {
    create: `
      CREATE TABLE songwriter (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        pro_affiliation VARCHAR(100),
        ipi_number VARCHAR(20),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(name, pro_affiliation, ipi_number)
      )`,
    primaryKey: 'id',
  },

  // ── Tier 2: Depends on brand ──────────────────────────────────────────────
  "user": {
    create: `
      CREATE TABLE "user" (
        id SERIAL PRIMARY KEY,
        username VARCHAR(45),
        password_md5 VARCHAR(255),
        password_hash VARCHAR(60),
        email_address VARCHAR(255) NOT NULL,
        first_name VARCHAR(45),
        last_name VARCHAR(45),
        profile_photo VARCHAR(255),
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        is_system_user BOOLEAN NOT NULL DEFAULT FALSE,
        brand_id INTEGER REFERENCES brand(id),
        reset_hash VARCHAR(255),
        last_logged_in TIMESTAMP WITH TIME ZONE,
        onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
        google_id VARCHAR(255),
        terms_accepted_at TIMESTAMP WITH TIME ZONE
      )`,
    primaryKey: 'id',
    booleanColumns: ['is_admin', 'is_system_user', 'onboarding_completed'],
  },

  domain: {
    create: `
      CREATE TABLE domain (
        brand_id INTEGER NOT NULL REFERENCES brand(id),
        domain_name VARCHAR(255) NOT NULL,
        status enum_domain_status DEFAULT 'Unverified',
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (brand_id, domain_name)
      )`,
    booleanColumns: ['is_primary'],
  },

  artist: {
    create: `
      CREATE TABLE artist (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        facebook_handle VARCHAR(45),
        instagram_handle VARCHAR(45),
        twitter_handle VARCHAR(45),
        bio VARCHAR(4096),
        website_page_url VARCHAR(1024),
        profile_photo VARCHAR(255),
        profile_photo_id INTEGER,
        brand_id INTEGER NOT NULL REFERENCES brand(id),
        tiktok_handle VARCHAR(45),
        band_members VARCHAR(4096),
        youtube_channel VARCHAR(255),
        payout_point INTEGER NOT NULL DEFAULT 1000,
        hold_payouts BOOLEAN NOT NULL DEFAULT FALSE,
        epk_template INTEGER NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
    booleanColumns: ['hold_payouts'],
  },

  // ── Tier 3: Depends on brand + user/artist ────────────────────────────────
  release: {
    create: `
      CREATE TABLE release (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        catalog_no VARCHAR(6) NOT NULL UNIQUE,
        "UPC" VARCHAR(45),
        spotify_link VARCHAR(1024),
        apple_music_link VARCHAR(1024),
        youtube_link VARCHAR(1024),
        release_date DATE,
        status enum_release_status NOT NULL DEFAULT 'Draft',
        cover_art VARCHAR(255),
        description TEXT,
        liner_notes TEXT,
        brand_id INTEGER NOT NULL REFERENCES brand(id),
        exclude_from_epk BOOLEAN NOT NULL DEFAULT FALSE
      )`,
    primaryKey: 'id',
    booleanColumns: ['exclude_from_epk'],
    dateOnlyColumns: ['release_date'],
  },

  event: {
    create: `
      CREATE TABLE event (
        id SERIAL PRIMARY KEY,
        brand_id INTEGER NOT NULL REFERENCES brand(id),
        title VARCHAR(255) NOT NULL,
        date_and_time TIMESTAMP WITH TIME ZONE NOT NULL,
        venue VARCHAR(255) NOT NULL,
        description TEXT,
        poster_url VARCHAR(255),
        rsvp_link VARCHAR(255),
        ticket_price DECIMAL(10,0) NOT NULL,
        buy_shortlink VARCHAR(1024),
        close_time TIMESTAMP WITH TIME ZONE,
        verification_pin VARCHAR(6) NOT NULL,
        verification_link VARCHAR(1024) NOT NULL,
        supports_gcash BOOLEAN NOT NULL DEFAULT TRUE,
        supports_qrph BOOLEAN NOT NULL DEFAULT TRUE,
        supports_card BOOLEAN NOT NULL DEFAULT TRUE,
        supports_ubp BOOLEAN NOT NULL DEFAULT TRUE,
        supports_dob BOOLEAN NOT NULL DEFAULT TRUE,
        supports_maya BOOLEAN NOT NULL DEFAULT TRUE,
        supports_grabpay BOOLEAN NOT NULL DEFAULT TRUE,
        max_tickets INTEGER DEFAULT 0,
        ticket_naming VARCHAR(45) NOT NULL DEFAULT 'Regular',
        countdown_display enum_event_countdown_display NOT NULL DEFAULT '1_week',
        show_tickets_remaining BOOLEAN NOT NULL DEFAULT TRUE,
        google_place_id VARCHAR(255),
        venue_address VARCHAR(500),
        venue_latitude DECIMAL(10,8),
        venue_longitude DECIMAL(11,8),
        venue_phone VARCHAR(50),
        venue_website VARCHAR(500),
        venue_maps_url VARCHAR(1000),
        status enum_event_status NOT NULL DEFAULT 'draft',
        walk_in_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        walk_in_supports_cash BOOLEAN NOT NULL DEFAULT FALSE,
        walk_in_supports_gcash BOOLEAN NOT NULL DEFAULT FALSE,
        walk_in_supports_card BOOLEAN NOT NULL DEFAULT FALSE,
        walk_in_max_count INTEGER NOT NULL DEFAULT 0,
        event_type enum_event_type,
        ticketing_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        external_ticket_link VARCHAR(1024),
        listed_on_ticketing BOOLEAN NOT NULL DEFAULT TRUE
      )`,
    primaryKey: 'id',
    booleanColumns: [
      'supports_gcash', 'supports_qrph', 'supports_card', 'supports_ubp',
      'supports_dob', 'supports_maya', 'supports_grabpay', 'show_tickets_remaining',
      'walk_in_enabled', 'walk_in_supports_cash', 'walk_in_supports_gcash', 'walk_in_supports_card',
      'ticketing_enabled', 'listed_on_ticketing',
    ],
  },

  fundraiser: {
    create: `
      CREATE TABLE fundraiser (
        id SERIAL PRIMARY KEY,
        brand_id INTEGER NOT NULL REFERENCES brand(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        poster_url VARCHAR(500),
        status enum_fundraiser_status NOT NULL DEFAULT 'draft',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
  },

  sync_licensing_pitch: {
    create: `
      CREATE TABLE sync_licensing_pitch (
        id SERIAL PRIMARY KEY,
        brand_id INTEGER NOT NULL REFERENCES brand(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        created_by INTEGER NOT NULL REFERENCES "user"(id),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
  },

  song: {
    create: `
      CREATE TABLE song (
        id SERIAL PRIMARY KEY,
        brand_id INTEGER REFERENCES brand(id),
        title VARCHAR(255) NOT NULL,
        duration INTEGER,
        tempo REAL,
        lyrics TEXT,
        audio_file VARCHAR(255),
        audio_file_mp3 VARCHAR(255),
        audio_file_size BIGINT,
        audio_file_mp3_size BIGINT,
        isrc VARCHAR(20),
        spotify_link VARCHAR(1024),
        apple_music_link VARCHAR(1024),
        youtube_link VARCHAR(1024),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
  },

  payment_method: {
    create: `
      CREATE TABLE payment_method (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER NOT NULL REFERENCES artist(id),
        type VARCHAR(45) NOT NULL,
        account_name VARCHAR(45) NOT NULL,
        account_number_or_email VARCHAR(45) NOT NULL,
        is_default_for_artist BOOLEAN NOT NULL DEFAULT FALSE,
        bank_code VARCHAR(45) NOT NULL DEFAULT 'N/A'
      )`,
    primaryKey: 'id',
    booleanColumns: ['is_default_for_artist'],
  },

  label_payment_method: {
    create: `
      CREATE TABLE label_payment_method (
        id SERIAL PRIMARY KEY,
        brand_id INTEGER NOT NULL REFERENCES brand(id),
        type VARCHAR(45) NOT NULL,
        account_name VARCHAR(45) NOT NULL,
        account_number_or_email VARCHAR(45) NOT NULL,
        is_default_for_brand BOOLEAN NOT NULL DEFAULT FALSE,
        bank_code VARCHAR(45) NOT NULL DEFAULT 'N/A'
      )`,
    primaryKey: 'id',
    booleanColumns: ['is_default_for_brand'],
  },

  // ── Tier 4: Depends on tier 2/3 entities ──────────────────────────────────
  artist_image: {
    create: `
      CREATE TABLE artist_image (
        id SERIAL PRIMARY KEY,
        path VARCHAR(255) NOT NULL,
        credits VARCHAR(1024),
        artist_id INTEGER NOT NULL REFERENCES artist(id),
        date_uploaded DATE NOT NULL,
        exclude_from_epk BOOLEAN NOT NULL DEFAULT FALSE,
        display_order INTEGER
      )`,
    primaryKey: 'id',
    booleanColumns: ['exclude_from_epk'],
  },

  artist_documents: {
    create: `
      CREATE TABLE artist_documents (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        path VARCHAR(255) NOT NULL,
        date_uploaded DATE,
        artist_id INTEGER NOT NULL REFERENCES artist(id)
      )`,
    primaryKey: 'id',
  },

  ticket_type: {
    create: `
      CREATE TABLE ticket_type (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES event(id),
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        max_tickets INTEGER NOT NULL DEFAULT 0,
        start_date TIMESTAMP WITH TIME ZONE,
        end_date TIMESTAMP WITH TIME ZONE,
        disabled BOOLEAN NOT NULL DEFAULT FALSE,
        special_instructions TEXT,
        special_instructions_for_scanner TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
    booleanColumns: ['disabled'],
  },

  event_referrer: {
    create: `
      CREATE TABLE event_referrer (
        id SERIAL PRIMARY KEY,
        name VARCHAR(45) NOT NULL,
        referral_code VARCHAR(45) NOT NULL UNIQUE,
        event_id INTEGER NOT NULL REFERENCES event(id),
        referral_shortlink VARCHAR(1024)
      )`,
    primaryKey: 'id',
  },

  walk_in_type: {
    create: `
      CREATE TABLE walk_in_type (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES event(id),
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        max_slots INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
  },

  // ── Tier 5: Junction tables ───────────────────────────────────────────────
  release_artist: {
    create: `
      CREATE TABLE release_artist (
        artist_id INTEGER NOT NULL REFERENCES artist(id),
        release_id INTEGER NOT NULL REFERENCES release(id),
        streaming_royalty_percentage DECIMAL(4,3) NOT NULL DEFAULT 0.500,
        streaming_royalty_type enum_royalty_type NOT NULL DEFAULT 'Revenue',
        sync_royalty_percentage DECIMAL(4,3) NOT NULL DEFAULT 0.500,
        sync_royalty_type enum_royalty_type NOT NULL DEFAULT 'Revenue',
        download_royalty_percentage DECIMAL(4,3) NOT NULL DEFAULT 0.500,
        download_royalty_type enum_royalty_type NOT NULL DEFAULT 'Revenue',
        physical_royalty_percentage DECIMAL(4,3) NOT NULL DEFAULT 0.200,
        physical_royalty_type enum_royalty_type NOT NULL DEFAULT 'Revenue',
        PRIMARY KEY (artist_id, release_id)
      )`,
  },

  artist_access: {
    create: `
      CREATE TABLE artist_access (
        artist_id INTEGER NOT NULL REFERENCES artist(id),
        user_id INTEGER NOT NULL REFERENCES "user"(id),
        can_view_payments BOOLEAN NOT NULL DEFAULT TRUE,
        can_view_royalties BOOLEAN NOT NULL DEFAULT TRUE,
        can_edit_artist_profile BOOLEAN NOT NULL DEFAULT TRUE,
        status enum_artist_access_status NOT NULL DEFAULT 'Pending',
        invite_hash VARCHAR(255),
        PRIMARY KEY (artist_id, user_id)
      )`,
    booleanColumns: ['can_view_payments', 'can_view_royalties', 'can_edit_artist_profile'],
  },

  release_song: {
    create: `
      CREATE TABLE release_song (
        id SERIAL PRIMARY KEY,
        release_id INTEGER NOT NULL REFERENCES release(id),
        song_id INTEGER NOT NULL REFERENCES song(id),
        track_number INTEGER,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
  },

  song_collaborator: {
    create: `
      CREATE TABLE song_collaborator (
        id SERIAL PRIMARY KEY,
        song_id INTEGER NOT NULL REFERENCES song(id),
        artist_id INTEGER NOT NULL REFERENCES artist(id),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
  },

  song_author: {
    create: `
      CREATE TABLE song_author (
        id SERIAL PRIMARY KEY,
        song_id INTEGER NOT NULL REFERENCES song(id),
        songwriter_id INTEGER REFERENCES songwriter(id),
        share_percentage DECIMAL(5,2),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
  },

  song_composer: {
    create: `
      CREATE TABLE song_composer (
        id SERIAL PRIMARY KEY,
        song_id INTEGER NOT NULL REFERENCES song(id),
        songwriter_id INTEGER REFERENCES songwriter(id),
        share_percentage DECIMAL(5,2),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
  },

  sync_licensing_pitch_song: {
    create: `
      CREATE TABLE sync_licensing_pitch_song (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER NOT NULL REFERENCES sync_licensing_pitch(id),
        song_id INTEGER NOT NULL REFERENCES song(id),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
  },

  // ── Tier 6: Transactional ─────────────────────────────────────────────────
  ticket: {
    create: `
      CREATE TABLE ticket (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES event(id),
        ticket_type_id INTEGER REFERENCES ticket_type(id),
        name VARCHAR(255) NOT NULL,
        email_address VARCHAR(255) NOT NULL,
        contact_number VARCHAR(45),
        number_of_entries INTEGER NOT NULL DEFAULT 1,
        number_of_claimed_entries INTEGER NOT NULL DEFAULT 0,
        ticket_code VARCHAR(5) NOT NULL,
        status enum_ticket_status NOT NULL DEFAULT 'New',
        payment_link VARCHAR(255),
        payment_link_id VARCHAR(45),
        checkout_key VARCHAR(255),
        payment_id VARCHAR(100),
        price_per_ticket DECIMAL(10,2),
        payment_processing_fee DECIMAL(10,2),
        platform_fee DECIMAL(10,2),
        referrer_id INTEGER REFERENCES event_referrer(id),
        order_timestamp TIMESTAMP WITH TIME ZONE,
        date_paid TIMESTAMP WITH TIME ZONE
      )`,
    primaryKey: 'id',
  },

  earning: {
    create: `
      CREATE TABLE earning (
        id SERIAL PRIMARY KEY,
        release_id INTEGER NOT NULL REFERENCES release(id),
        type enum_earning_type NOT NULL DEFAULT 'Streaming',
        amount DECIMAL(10,2),
        description VARCHAR(255),
        date_recorded DATE NOT NULL,
        platform_fee DECIMAL(10,2) DEFAULT 0
      )`,
    primaryKey: 'id',
  },

  royalty: {
    create: `
      CREATE TABLE royalty (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER NOT NULL REFERENCES artist(id),
        earning_id INTEGER,
        percentage_of_earning DECIMAL(3,3),
        amount DECIMAL(10,2) NOT NULL,
        release_id INTEGER REFERENCES release(id),
        description VARCHAR(255),
        date_recorded DATE NOT NULL
      )`,
    primaryKey: 'id',
  },

  payment: {
    create: `
      CREATE TABLE payment (
        id SERIAL PRIMARY KEY,
        description VARCHAR(45),
        amount DECIMAL(10,2) NOT NULL,
        artist_id INTEGER NOT NULL REFERENCES artist(id),
        date_paid TIMESTAMP WITH TIME ZONE NOT NULL,
        paid_thru_type VARCHAR(45),
        paid_thru_account_name VARCHAR(45),
        paid_thru_account_number VARCHAR(45),
        payment_method_id INTEGER REFERENCES payment_method(id),
        reference_number VARCHAR(45),
        payment_processing_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        status enum_payment_status NOT NULL DEFAULT 'succeeded',
        paymongo_transfer_id VARCHAR(100),
        failure_reason TEXT
      )`,
    primaryKey: 'id',
  },

  label_payment: {
    create: `
      CREATE TABLE label_payment (
        id SERIAL PRIMARY KEY,
        description VARCHAR(45),
        amount DECIMAL(10,2) NOT NULL,
        brand_id INTEGER NOT NULL REFERENCES brand(id),
        date_paid TIMESTAMP WITH TIME ZONE NOT NULL,
        paid_thru_type VARCHAR(45),
        paid_thru_account_name VARCHAR(45),
        paid_thru_account_number VARCHAR(45),
        payment_method_id INTEGER REFERENCES label_payment_method(id),
        reference_number VARCHAR(100),
        payment_processing_fee DECIMAL(10,2) DEFAULT 0,
        status enum_payment_status NOT NULL DEFAULT 'succeeded',
        paymongo_transfer_id VARCHAR(100),
        failure_reason TEXT
      )`,
    primaryKey: 'id',
  },

  donation: {
    create: `
      CREATE TABLE donation (
        id SERIAL PRIMARY KEY,
        fundraiser_id INTEGER NOT NULL REFERENCES fundraiser(id),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        contact_number VARCHAR(45),
        amount DECIMAL(10,2) NOT NULL,
        payment_status enum_donation_payment_status NOT NULL DEFAULT 'pending',
        processing_fee DECIMAL(10,2),
        platform_fee DECIMAL(10,2),
        payment_reference VARCHAR(255),
        checkout_key VARCHAR(100),
        payment_id VARCHAR(100),
        anonymous BOOLEAN NOT NULL DEFAULT FALSE,
        order_timestamp TIMESTAMP WITH TIME ZONE,
        date_paid TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
    booleanColumns: ['anonymous'],
  },

  walk_in_transaction: {
    create: `
      CREATE TABLE walk_in_transaction (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES event(id),
        payment_method enum_walk_in_payment_method NOT NULL,
        payment_reference VARCHAR(255),
        total_amount DECIMAL(10,2) NOT NULL,
        registered_by INTEGER NOT NULL REFERENCES "user"(id),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
  },

  walk_in_transaction_item: {
    create: `
      CREATE TABLE walk_in_transaction_item (
        id SERIAL PRIMARY KEY,
        walk_in_transaction_id INTEGER NOT NULL REFERENCES walk_in_transaction(id),
        walk_in_type_id INTEGER NOT NULL REFERENCES walk_in_type(id),
        quantity INTEGER NOT NULL,
        price_per_unit DECIMAL(10,2) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
  },

  // ── Tier 7: Logs ──────────────────────────────────────────────────────────
  login_attempt: {
    create: `
      CREATE TABLE login_attempt (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "user"(id),
        status enum_login_attempt_status NOT NULL,
        date_and_time TIMESTAMP WITH TIME ZONE NOT NULL,
        brand_id INTEGER NOT NULL REFERENCES brand(id),
        proxy_ip VARCHAR(45),
        remote_ip VARCHAR(45)
      )`,
    primaryKey: 'id',
  },

  email_attempt: {
    create: `
      CREATE TABLE email_attempt (
        id SERIAL PRIMARY KEY,
        recipients VARCHAR(1024) NOT NULL,
        subject VARCHAR(1024) NOT NULL,
        body TEXT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        result enum_email_attempt_result NOT NULL,
        brand_id INTEGER NOT NULL REFERENCES brand(id)
      )`,
    primaryKey: 'id',
  },

  recuperable_expense: {
    create: `
      CREATE TABLE recuperable_expense (
        id SERIAL PRIMARY KEY,
        release_id INTEGER NOT NULL REFERENCES release(id),
        expense_description VARCHAR(45) NOT NULL,
        expense_amount DECIMAL(10,2) NOT NULL,
        date_recorded DATE,
        brand_id INTEGER NOT NULL REFERENCES brand(id)
      )`,
    primaryKey: 'id',
  },

  // ── Tier 8: New tables ────────────────────────────────────────────────────
  event_tag: {
    create: `
      CREATE TABLE event_tag (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        is_custom BOOLEAN NOT NULL DEFAULT FALSE,
        brand_id INTEGER REFERENCES brand(id),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
    booleanColumns: ['is_custom'],
  },

  event_tag_mapping: {
    create: `
      CREATE TABLE event_tag_mapping (
        event_id INTEGER NOT NULL REFERENCES event(id),
        tag_id INTEGER NOT NULL REFERENCES event_tag(id),
        PRIMARY KEY (event_id, tag_id)
      )`,
  },

  notification: {
    create: `
      CREATE TABLE notification (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "user"(id),
        brand_id INTEGER NOT NULL REFERENCES brand(id),
        type VARCHAR(100) NOT NULL,
        title VARCHAR(500) NOT NULL,
        message TEXT,
        link VARCHAR(500),
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
    primaryKey: 'id',
    booleanColumns: ['is_read'],
  },
};

// Ordered list of table names for migration (FK dependency order)
const TABLE_ORDER = Object.keys(TABLES);

// ── Helpers ─────────────────────────────────────────────────────────────────

function convertValue(value: any, column: string, tableDef: TableDef): any {
  if (value === null || value === undefined) return null;

  // Boolean conversion: 0/1 → false/true
  if (tableDef.booleanColumns?.includes(column)) {
    return !!value;
  }

  // Date '0000-00-00' → null
  if (tableDef.dateOnlyColumns?.includes(column)) {
    if (value === '0000-00-00' || value === '0000-00-00 00:00:00') return null;
    const str = String(value);
    if (str.startsWith('0000')) return null;
  }

  return value;
}

function escapeIdentifier(name: string): string {
  // Quote reserved words and camelCase columns
  const reserved = ['user', 'release', 'order', 'group', 'table', 'select', 'where', 'from', 'to', 'UPC'];
  if (reserved.includes(name) || name.includes(' ') || /[A-Z]/.test(name)) {
    return `"${name}"`;
  }
  return name;
}

// ── Main migration ──────────────────────────────────────────────────────────

interface SkippedRow {
  table: string;
  row_data: Record<string, any>;
  error_detail: string;
}

async function batchInsert(
  pgClient: any,
  tableName: string,
  colNames: string,
  columns: string[],
  rows: any[][],
  batchSize: number,
  skippedRows: SkippedRow[],
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  // Try fast batch insert first
  await pgClient.query('BEGIN');
  try {
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const allValues: any[] = [];
      const rowPlaceholders: string[] = [];
      let paramIndex = 1;

      for (const rowValues of batch) {
        const placeholders: string[] = [];
        for (const value of rowValues) {
          placeholders.push(`$${paramIndex++}`);
          allValues.push(value);
        }
        rowPlaceholders.push(`(${placeholders.join(', ')})`);
      }

      const insertSQL = `INSERT INTO ${escapeIdentifier(tableName)} (${colNames}) VALUES ${rowPlaceholders.join(', ')}`;
      await pgClient.query(insertSQL, allValues);
      inserted += batch.length;
    }
    await pgClient.query('COMMIT');
    return { inserted, skipped };
  } catch (err: any) {
    await pgClient.query('ROLLBACK');

    // If it's an FK violation, fall back to row-by-row with SAVEPOINTs
    if (err.code === '23503') {
      inserted = 0;
      skipped = 0;
      await pgClient.query('BEGIN');
      for (let r = 0; r < rows.length; r++) {
        const rowValues = rows[r];
        const singlePlaceholders = rowValues.map((_: any, idx: number) => `$${idx + 1}`);
        await pgClient.query(`SAVEPOINT sp_${r}`);
        try {
          await pgClient.query(
            `INSERT INTO ${escapeIdentifier(tableName)} (${colNames}) VALUES (${singlePlaceholders.join(', ')})`,
            rowValues
          );
          await pgClient.query(`RELEASE SAVEPOINT sp_${r}`);
          inserted++;
        } catch (innerErr: any) {
          await pgClient.query(`ROLLBACK TO SAVEPOINT sp_${r}`);
          if (innerErr.code === '23503') {
            skipped++;
            // Build row data object for the log
            const rowData: Record<string, any> = {};
            for (let c = 0; c < columns.length; c++) {
              rowData[columns[c]] = rowValues[c];
            }
            skippedRows.push({
              table: tableName,
              row_data: rowData,
              error_detail: innerErr.detail || innerErr.message,
            });
          } else {
            await pgClient.query('ROLLBACK');
            throw innerErr;
          }
        }
      }
      await pgClient.query('COMMIT');
      return { inserted, skipped };
    }

    throw err;
  }
}

async function main() {
  const RESUME_FROM = process.env.RESUME_FROM || '';
  const isResuming = !!RESUME_FROM;

  if (isResuming && !TABLES[RESUME_FROM]) {
    console.error(`Error: RESUME_FROM table "${RESUME_FROM}" not found. Valid tables: ${TABLE_ORDER.join(', ')}`);
    process.exit(1);
  }

  console.log('=== MySQL to PostgreSQL Migration ===\n');
  if (isResuming) {
    console.log(`*** RESUME MODE: Starting from table "${RESUME_FROM}" ***\n`);
  }

  // Connect to MySQL
  console.log('Connecting to MySQL...');
  const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
  console.log(`  Connected to MySQL: ${MYSQL_CONFIG.host}/${MYSQL_CONFIG.database}`);

  // Connect to PostgreSQL
  console.log('Connecting to PostgreSQL...');
  const pgClient = new Client(PG_CONFIG);
  await pgClient.connect();
  console.log(`  Connected to PostgreSQL: ${(PG_CONFIG as any).host}/${PG_CONFIG.database}\n`);

  try {
    // Disable statement timeout for long-running migration operations
    await pgClient.query('SET statement_timeout = 0');
    console.log('Statement timeout disabled.\n');

    if (!isResuming) {
      // ── Step 1: Drop tables in reverse order ────────────────────────────
      console.log('Dropping existing tables (reverse order)...');
      const reversedTables = [...TABLE_ORDER].reverse();
      for (const tableName of reversedTables) {
        await pgClient.query(`DROP TABLE IF EXISTS ${escapeIdentifier(tableName)} CASCADE`);
      }
      console.log('  All tables dropped.\n');

      // ── Step 2: Drop and recreate ENUM types ────────────────────────────
      console.log('Creating ENUM types...');
      for (const [enumName, values] of Object.entries(ENUM_TYPES)) {
        await pgClient.query(`DROP TYPE IF EXISTS ${enumName} CASCADE`);
        const valuesStr = values.map(v => `'${v}'`).join(', ');
        await pgClient.query(`CREATE TYPE ${enumName} AS ENUM (${valuesStr})`);
        console.log(`  Created ${enumName}`);
      }
      console.log('');

      // ── Step 3: Create tables ───────────────────────────────────────────
      console.log('Creating tables...');
      for (const tableName of TABLE_ORDER) {
        await pgClient.query(TABLES[tableName].create);
        console.log(`  Created ${tableName}`);
      }
      console.log('');

      // ── Step 4: Add artist.profile_photo_id FK after artist_image exists
      await pgClient.query(`
        ALTER TABLE artist
        ADD CONSTRAINT artist_profile_photo_id_fkey
        FOREIGN KEY (profile_photo_id) REFERENCES artist_image(id)
      `);
      console.log('Added deferred FK: artist.profile_photo_id → artist_image.id\n');
    }

    // ── Step 5: Migrate data table by table ───────────────────────────────
    console.log('Migrating data...\n');
    const rowCounts: Record<string, { mysql: number; pg: number }> = {};
    const skippedRows: SkippedRow[] = [];

    // Determine which tables to process
    let startIndex = 0;
    if (isResuming) {
      startIndex = TABLE_ORDER.indexOf(RESUME_FROM);
      // Log counts for skipped tables
      for (let i = 0; i < startIndex; i++) {
        const t = TABLE_ORDER[i];
        const [countRows] = await mysqlConn.query(`SELECT COUNT(*) as cnt FROM \`${t}\``) as [any[], any];
        const mysqlCount = countRows[0].cnt;
        const pgResult = await pgClient.query(`SELECT COUNT(*) as count FROM ${escapeIdentifier(t)}`);
        const pgCount = parseInt(pgResult.rows[0].count);
        rowCounts[t] = { mysql: mysqlCount, pg: pgCount };
        const match = mysqlCount === pgCount ? 'OK' : 'MISMATCH!';
        console.log(`  ${t}: ${mysqlCount} → ${pgCount} [${match}] (skipped - already migrated)`);
      }
      // Truncate the resume table in case of partial data
      console.log(`\n  Truncating ${RESUME_FROM} (clearing partial data)...`);
      await pgClient.query(`TRUNCATE TABLE ${escapeIdentifier(RESUME_FROM)} CASCADE`);
      console.log('');
    }

    for (let tableIdx = startIndex; tableIdx < TABLE_ORDER.length; tableIdx++) {
      const tableName = TABLE_ORDER[tableIdx];
      const tableDef = TABLES[tableName];
      const mysqlTableName = tableName;

      // Get total row count from MySQL
      const [countRows] = await mysqlConn.query(`SELECT COUNT(*) as cnt FROM \`${mysqlTableName}\``) as [any[], any];
      const mysqlCount = countRows[0].cnt;

      if (mysqlCount === 0) {
        console.log(`  ${tableName}: 0 rows (empty)`);
        rowCounts[tableName] = { mysql: 0, pg: 0 };
        continue;
      }

      // Get column names from a single row
      const [sampleRows] = await mysqlConn.query(`SELECT * FROM \`${mysqlTableName}\` LIMIT 1`) as [any[], any];
      const mysqlColumns = Object.keys(sampleRows[0]);

      // Filter to only columns that exist in the PG table
      const pgColResult = await pgClient.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
        [tableName]
      );
      const pgColumnSet = new Set(pgColResult.rows.map((r: any) => r.column_name));
      const columns = mysqlColumns.filter(c => pgColumnSet.has(c));
      const skippedCols = mysqlColumns.filter(c => !pgColumnSet.has(c));
      if (skippedCols.length > 0) {
        console.log(`  ${tableName}: skipping MySQL-only columns: ${skippedCols.join(', ')}`);
      }

      // Special handling for deferred FK references:
      // Insert with NULL first, then update after referenced table is populated
      const isBrand = tableName === 'brand';
      const isArtist = tableName === 'artist';
      const brandParentUpdates: { id: number; parent_brand: number }[] = [];
      const artistPhotoUpdates: { id: number; profile_photo_id: number }[] = [];

      // Insert in batched multi-row VALUES for performance over remote connections
      const colNames = columns.map(c => escapeIdentifier(c)).join(', ');
      let totalInserted = 0;
      let totalSkipped = 0;
      const chunkSize = 500;
      const batchSize = 50; // rows per multi-row INSERT

      for (let offset = 0; offset < mysqlCount; offset += chunkSize) {
        const [chunkRows] = await mysqlConn.query(
          `SELECT * FROM \`${mysqlTableName}\` LIMIT ${chunkSize} OFFSET ${offset}`
        ) as [any[], any];

        // Pre-process rows: extract deferred FK updates and convert values
        const processedRows: any[][] = [];
        for (const row of chunkRows) {
          const values: any[] = [];
          for (const col of columns) {
            let value = convertValue(row[col], col, tableDef);

            // For brand: NULL out parent_brand to avoid FK violation, save for later
            if (isBrand && col === 'parent_brand' && value !== null) {
              brandParentUpdates.push({ id: row.id, parent_brand: value });
              value = null;
            }

            // For artist: NULL out profile_photo_id (references artist_image, not yet populated)
            if (isArtist && col === 'profile_photo_id' && value !== null) {
              artistPhotoUpdates.push({ id: row.id, profile_photo_id: value });
              value = null;
            }

            values.push(value);
          }
          processedRows.push(values);
        }

        // Try batch insert first; falls back to row-by-row on FK violations
        const result = await batchInsert(pgClient, tableName, colNames, columns, processedRows, batchSize, skippedRows);
        totalInserted += result.inserted;
        totalSkipped += result.skipped;

        // Log progress for large tables
        if (mysqlCount > chunkSize) {
          const progress = Math.min(offset + chunkSize, mysqlCount);
          process.stdout.write(`\r  ${tableName}: ${progress}/${mysqlCount}...`);
        }
      }

      if (mysqlCount > chunkSize) {
        process.stdout.write('\r' + ' '.repeat(60) + '\r'); // Clear progress line
      }

      if (totalSkipped > 0) {
        console.log(`  ${tableName}: skipped ${totalSkipped} orphaned rows (FK violations)`);
      }

      // For brand: update parent_brand references
      if (isBrand && brandParentUpdates.length > 0) {
        for (const update of brandParentUpdates) {
          await pgClient.query('UPDATE brand SET parent_brand = $1 WHERE id = $2', [update.parent_brand, update.id]);
        }
        console.log(`  brand: updated ${brandParentUpdates.length} parent_brand references`);
      }

      // For artist: update profile_photo_id after artist_image is populated
      // (artist_image is inserted later in the table order, so we defer this)
      if (isArtist && artistPhotoUpdates.length > 0) {
        // Store for later — we'll apply after artist_image is migrated
        (global as any).__artistPhotoUpdates = artistPhotoUpdates;
        console.log(`  artist: deferred ${artistPhotoUpdates.length} profile_photo_id updates`);
      }

      // After artist_image is migrated, apply the deferred artist profile_photo_id updates
      if (tableName === 'artist_image' && (global as any).__artistPhotoUpdates) {
        const updates = (global as any).__artistPhotoUpdates as { id: number; profile_photo_id: number }[];
        for (const update of updates) {
          await pgClient.query('UPDATE artist SET profile_photo_id = $1 WHERE id = $2', [update.profile_photo_id, update.id]);
        }
        console.log(`  artist: applied ${updates.length} deferred profile_photo_id updates`);
        delete (global as any).__artistPhotoUpdates;
      }

      // Verify count
      const pgResult = await pgClient.query(`SELECT COUNT(*) as count FROM ${escapeIdentifier(tableName)}`);
      const pgCount = parseInt(pgResult.rows[0].count);

      rowCounts[tableName] = { mysql: mysqlCount, pg: pgCount };
      const match = mysqlCount === pgCount ? 'OK' : 'MISMATCH!';
      console.log(`  ${tableName}: ${mysqlCount} → ${pgCount} [${match}]`);
    }

    // ── Step 6: Reset sequences ───────────────────────────────────────────
    console.log('\nResetting sequences...');
    for (const tableName of TABLE_ORDER) {
      const tableDef = TABLES[tableName];
      if (!tableDef.primaryKey) continue;

      const pk = tableDef.primaryKey;
      const seqName = `${tableName}_${pk}_seq`;
      const maxResult = await pgClient.query(
        `SELECT COALESCE(MAX(${escapeIdentifier(pk)}), 0) + 1 as next_val FROM ${escapeIdentifier(tableName)}`
      );
      const nextVal = parseInt(maxResult.rows[0].next_val);
      await pgClient.query(`SELECT setval('${seqName}', $1, false)`, [nextVal]);
      console.log(`  ${seqName} → ${nextVal}`);
    }

    // ── Step 7: Add SequelizeMeta table for migrations ────────────────────
    console.log('\nCreating SequelizeMeta table...');
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
        name VARCHAR(255) NOT NULL PRIMARY KEY
      )
    `);
    console.log('  SequelizeMeta created.');

    // ── Write skipped rows CSV ──────────────────────────────────────────
    if (skippedRows.length > 0) {
      const csvPath = path.join(__dirname, 'migration-skipped-rows.csv');
      const csvEscape = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Collect all unique column names across skipped rows
      const allColumns = new Set<string>();
      for (const row of skippedRows) {
        for (const key of Object.keys(row.row_data)) {
          allColumns.add(key);
        }
      }
      const dataColumns = Array.from(allColumns);

      const header = ['table', 'error_detail', ...dataColumns].map(csvEscape).join(',');
      const lines = skippedRows.map(row => {
        const values = [
          row.table,
          row.error_detail,
          ...dataColumns.map(col => row.row_data[col] ?? ''),
        ];
        return values.map(csvEscape).join(',');
      });

      fs.writeFileSync(csvPath, [header, ...lines].join('\n'), 'utf-8');
      console.log(`\nSkipped rows log: ${csvPath} (${skippedRows.length} rows)`);
    } else {
      console.log('\nNo skipped rows — all data migrated cleanly.');
    }

    // ── Summary ───────────────────────────────────────────────────────────
    console.log('\n=== Migration Summary ===\n');
    console.log('Table'.padEnd(35) + 'MySQL'.padEnd(10) + 'PostgreSQL'.padEnd(12) + 'Status');
    console.log('-'.repeat(65));
    let allOk = true;
    for (const [table, counts] of Object.entries(rowCounts)) {
      const status = counts.mysql === counts.pg ? 'OK' : 'MISMATCH';
      if (status !== 'OK') allOk = false;
      console.log(
        table.padEnd(35) +
        String(counts.mysql).padEnd(10) +
        String(counts.pg).padEnd(12) +
        status
      );
    }
    console.log('-'.repeat(65));
    console.log(allOk ? '\nAll tables migrated successfully!' : '\nSome tables have mismatches — please investigate.');

  } finally {
    await mysqlConn.end();
    await pgClient.end();
    console.log('\nConnections closed.');
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
