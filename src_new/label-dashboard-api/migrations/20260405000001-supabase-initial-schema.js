'use strict';

/**
 * PostgreSQL (Supabase) baseline migration.
 * Represents the full schema as migrated from MySQL.
 * All previous MySQL migrations are archived in mysql-archive/.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // ── ENUM types ──────────────────────────────────────────────────────
      await queryInterface.sequelize.query(`CREATE TYPE enum_domain_status AS ENUM ('Unverified', 'Pending', 'No SSL', 'Connected')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_artist_access_status AS ENUM ('Pending', 'Accepted')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_release_status AS ENUM ('Draft', 'For Submission', 'Pending', 'Live', 'Taken Down')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_event_countdown_display AS ENUM ('always', '1_week', '3_days', '1_day', 'never')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_event_status AS ENUM ('draft', 'published')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_ticket_status AS ENUM ('New', 'Payment Confirmed', 'Ticket sent.', 'Canceled', 'Refunded')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_login_attempt_status AS ENUM ('Successful', 'Failed')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_email_attempt_result AS ENUM ('Success', 'Failed')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_royalty_type AS ENUM ('Revenue', 'Profit')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_earning_type AS ENUM ('Sync', 'Streaming', 'Downloads', 'Physical')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_fee_revenue_type AS ENUM ('net', 'gross')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_fundraiser_status AS ENUM ('draft', 'published', 'closed')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_donation_payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_payment_status AS ENUM ('pending', 'succeeded', 'failed')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_walk_in_payment_method AS ENUM ('cash', 'gcash', 'card')`, { transaction });
      await queryInterface.sequelize.query(`CREATE TYPE enum_event_type AS ENUM ('concert', 'festival', 'club_night', 'open_mic', 'dj_set', 'listening_party', 'album_launch', 'workshop', 'meetup', 'other')`, { transaction });

      // ── Tables ──────────────────────────────────────────────────────────

      await queryInterface.createTable('brand', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        brand_name: { type: Sequelize.STRING(255), allowNull: false },
        logo_url: { type: Sequelize.STRING(255) },
        brand_color: { type: Sequelize.STRING(45), allowNull: false, defaultValue: '#ffffff' },
        brand_website: { type: Sequelize.STRING(255) },
        favicon_url: { type: Sequelize.STRING(255) },
        paymongo_wallet_id: { type: Sequelize.STRING(100) },
        payment_processing_fee_for_payouts: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        release_submission_url: { type: Sequelize.STRING(500) },
        catalog_prefix: { type: Sequelize.STRING(10), defaultValue: 'REL' },
        parent_brand: { type: Sequelize.INTEGER, references: { model: 'brand', key: 'id' } },
        monthly_fee: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        music_transaction_fixed_fee: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        music_revenue_percentage_fee: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0 },
        music_fee_revenue_type: { type: 'enum_fee_revenue_type', defaultValue: 'net' },
        event_transaction_fixed_fee: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        event_revenue_percentage_fee: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0 },
        event_fee_revenue_type: { type: 'enum_fee_revenue_type', defaultValue: 'net' },
        fundraiser_transaction_fixed_fee: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        fundraiser_revenue_percentage_fee: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0 },
        fundraiser_fee_revenue_type: { type: 'enum_fee_revenue_type', defaultValue: 'net' },
        feature_music_workspace: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        feature_campaigns_workspace: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        feature_sublabels: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      }, { transaction });

      await queryInterface.createTable('songwriter', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING(255), allowNull: false },
        pro_affiliation: { type: Sequelize.STRING(100) },
        ipi_number: { type: Sequelize.STRING(20) },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });
      await queryInterface.addIndex('songwriter', ['name', 'pro_affiliation', 'ipi_number'], { unique: true, transaction });

      await queryInterface.createTable('user', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        username: { type: Sequelize.STRING(45) },
        password_md5: { type: Sequelize.STRING(255) },
        password_hash: { type: Sequelize.STRING(60) },
        email_address: { type: Sequelize.STRING(255), allowNull: false },
        first_name: { type: Sequelize.STRING(45) },
        last_name: { type: Sequelize.STRING(45) },
        profile_photo: { type: Sequelize.STRING(255) },
        is_admin: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_system_user: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        brand_id: { type: Sequelize.INTEGER, references: { model: 'brand', key: 'id' }, defaultValue: 1 },
        reset_hash: { type: Sequelize.STRING(255) },
        last_logged_in: { type: Sequelize.DATE },
        onboarding_completed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        google_id: { type: Sequelize.STRING(255) },
        terms_accepted_at: { type: Sequelize.DATE },
      }, { transaction });

      await queryInterface.createTable('domain', {
        brand_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, references: { model: 'brand', key: 'id' } },
        domain_name: { type: Sequelize.STRING(255), allowNull: false, primaryKey: true },
        status: { type: 'enum_domain_status', defaultValue: 'Unverified' },
        is_primary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      }, { transaction });

      await queryInterface.createTable('artist', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING(255), allowNull: false },
        facebook_handle: { type: Sequelize.STRING(45) },
        instagram_handle: { type: Sequelize.STRING(45) },
        twitter_handle: { type: Sequelize.STRING(45) },
        bio: { type: Sequelize.STRING(4096) },
        website_page_url: { type: Sequelize.STRING(1024) },
        profile_photo: { type: Sequelize.STRING(255) },
        profile_photo_id: { type: Sequelize.INTEGER },
        brand_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'brand', key: 'id' }, defaultValue: 1 },
        tiktok_handle: { type: Sequelize.STRING(45) },
        band_members: { type: Sequelize.STRING(4096) },
        youtube_channel: { type: Sequelize.STRING(255) },
        payout_point: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1000 },
        hold_payouts: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        epk_template: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('release', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        title: { type: Sequelize.STRING(255) },
        catalog_no: { type: Sequelize.STRING(6), allowNull: false, unique: true },
        UPC: { type: Sequelize.STRING(45) },
        spotify_link: { type: Sequelize.STRING(1024) },
        apple_music_link: { type: Sequelize.STRING(1024) },
        youtube_link: { type: Sequelize.STRING(1024) },
        release_date: { type: Sequelize.DATEONLY },
        status: { type: 'enum_release_status', allowNull: false, defaultValue: 'Draft' },
        cover_art: { type: Sequelize.STRING(255) },
        description: { type: Sequelize.TEXT },
        liner_notes: { type: Sequelize.TEXT },
        brand_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'brand', key: 'id' } },
        exclude_from_epk: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      }, { transaction });

      await queryInterface.createTable('event', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        brand_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'brand', key: 'id' } },
        title: { type: Sequelize.STRING(255), allowNull: false },
        date_and_time: { type: Sequelize.DATE, allowNull: false },
        venue: { type: Sequelize.STRING(255), allowNull: false },
        description: { type: Sequelize.TEXT },
        poster_url: { type: Sequelize.STRING(255) },
        rsvp_link: { type: Sequelize.STRING(255) },
        ticket_price: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        buy_shortlink: { type: Sequelize.STRING(1024) },
        close_time: { type: Sequelize.DATE },
        verification_pin: { type: Sequelize.STRING(6), allowNull: false },
        verification_link: { type: Sequelize.STRING(1024), allowNull: false },
        supports_gcash: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        supports_qrph: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        supports_card: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        supports_ubp: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        supports_dob: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        supports_maya: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        supports_grabpay: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        max_tickets: { type: Sequelize.INTEGER, defaultValue: 0 },
        ticket_naming: { type: Sequelize.STRING(45), allowNull: false, defaultValue: 'Regular' },
        countdown_display: { type: 'enum_event_countdown_display', allowNull: false, defaultValue: '1_week' },
        show_tickets_remaining: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        google_place_id: { type: Sequelize.STRING(255) },
        venue_address: { type: Sequelize.STRING(500) },
        venue_latitude: { type: Sequelize.DECIMAL(10, 8) },
        venue_longitude: { type: Sequelize.DECIMAL(11, 8) },
        venue_phone: { type: Sequelize.STRING(50) },
        venue_website: { type: Sequelize.STRING(500) },
        venue_maps_url: { type: Sequelize.STRING(1000) },
        status: { type: 'enum_event_status', allowNull: false, defaultValue: 'draft' },
        event_type: { type: 'enum_event_type', allowNull: true, defaultValue: null },
        ticketing_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        external_ticket_link: { type: Sequelize.STRING(1024), allowNull: true, defaultValue: null },
        listed_on_ticketing: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        walk_in_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        walk_in_supports_cash: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        walk_in_supports_gcash: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        walk_in_supports_card: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        walk_in_max_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      }, { transaction });

      await queryInterface.createTable('fundraiser', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        brand_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'brand', key: 'id' } },
        title: { type: Sequelize.STRING(255), allowNull: false },
        description: { type: Sequelize.TEXT },
        poster_url: { type: Sequelize.STRING(500) },
        status: { type: 'enum_fundraiser_status', allowNull: false, defaultValue: 'draft' },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('sync_licensing_pitch', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        brand_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'brand', key: 'id' } },
        title: { type: Sequelize.STRING(255), allowNull: false },
        description: { type: Sequelize.TEXT },
        created_by: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'user', key: 'id' } },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('song', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        brand_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'brand', key: 'id' } },
        title: { type: Sequelize.STRING(255), allowNull: false },
        duration: { type: Sequelize.INTEGER },
        tempo: { type: Sequelize.FLOAT },
        lyrics: { type: Sequelize.TEXT },
        audio_file: { type: Sequelize.STRING(255) },
        audio_file_mp3: { type: Sequelize.STRING(255) },
        audio_file_size: { type: Sequelize.BIGINT },
        audio_file_mp3_size: { type: Sequelize.BIGINT },
        isrc: { type: Sequelize.STRING(20) },
        spotify_link: { type: Sequelize.STRING(1024) },
        apple_music_link: { type: Sequelize.STRING(1024) },
        youtube_link: { type: Sequelize.STRING(1024) },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('payment_method', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        artist_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'artist', key: 'id' } },
        type: { type: Sequelize.STRING(45), allowNull: false },
        account_name: { type: Sequelize.STRING(45), allowNull: false },
        account_number_or_email: { type: Sequelize.STRING(45), allowNull: false },
        is_default_for_artist: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        bank_code: { type: Sequelize.STRING(45), allowNull: false, defaultValue: 'N/A' },
      }, { transaction });

      await queryInterface.createTable('label_payment_method', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        brand_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'brand', key: 'id' } },
        type: { type: Sequelize.STRING(45), allowNull: false },
        account_name: { type: Sequelize.STRING(45), allowNull: false },
        account_number_or_email: { type: Sequelize.STRING(45), allowNull: false },
        is_default_for_brand: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        bank_code: { type: Sequelize.STRING(45), allowNull: false, defaultValue: 'N/A' },
      }, { transaction });

      await queryInterface.createTable('artist_image', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        path: { type: Sequelize.STRING(255), allowNull: false },
        credits: { type: Sequelize.STRING(1024) },
        artist_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'artist', key: 'id' } },
        date_uploaded: { type: Sequelize.DATEONLY, allowNull: false },
        exclude_from_epk: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        display_order: { type: Sequelize.INTEGER },
      }, { transaction });

      // Add deferred FK for artist.profile_photo_id → artist_image.id
      await queryInterface.addConstraint('artist', {
        fields: ['profile_photo_id'],
        type: 'foreign key',
        references: { table: 'artist_image', field: 'id' },
        transaction,
      });

      await queryInterface.createTable('artist_documents', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        title: { type: Sequelize.STRING(255) },
        path: { type: Sequelize.STRING(255), allowNull: false },
        date_uploaded: { type: Sequelize.DATEONLY },
        artist_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'artist', key: 'id' } },
      }, { transaction });

      await queryInterface.createTable('ticket_type', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        event_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'event', key: 'id' } },
        name: { type: Sequelize.STRING(100), allowNull: false },
        price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        max_tickets: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        start_date: { type: Sequelize.DATE },
        end_date: { type: Sequelize.DATE },
        disabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        special_instructions: { type: Sequelize.TEXT },
        special_instructions_for_scanner: { type: Sequelize.TEXT },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('event_referrer', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING(45), allowNull: false },
        referral_code: { type: Sequelize.STRING(45), allowNull: false, unique: true },
        event_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'event', key: 'id' } },
        referral_shortlink: { type: Sequelize.STRING(1024) },
      }, { transaction });

      await queryInterface.createTable('walk_in_type', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        event_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'event', key: 'id' } },
        name: { type: Sequelize.STRING(100), allowNull: false },
        price: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        max_slots: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      // Junction tables
      await queryInterface.createTable('release_artist', {
        artist_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, references: { model: 'artist', key: 'id' } },
        release_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, references: { model: 'release', key: 'id' } },
        streaming_royalty_percentage: { type: Sequelize.DECIMAL(4, 3), allowNull: false, defaultValue: 0.500 },
        streaming_royalty_type: { type: 'enum_royalty_type', allowNull: false, defaultValue: 'Revenue' },
        sync_royalty_percentage: { type: Sequelize.DECIMAL(4, 3), allowNull: false, defaultValue: 0.500 },
        sync_royalty_type: { type: 'enum_royalty_type', allowNull: false, defaultValue: 'Revenue' },
        download_royalty_percentage: { type: Sequelize.DECIMAL(4, 3), allowNull: false, defaultValue: 0.500 },
        download_royalty_type: { type: 'enum_royalty_type', allowNull: false, defaultValue: 'Revenue' },
        physical_royalty_percentage: { type: Sequelize.DECIMAL(4, 3), allowNull: false, defaultValue: 0.200 },
        physical_royalty_type: { type: 'enum_royalty_type', allowNull: false, defaultValue: 'Revenue' },
      }, { transaction });

      await queryInterface.createTable('artist_access', {
        artist_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, references: { model: 'artist', key: 'id' } },
        user_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, references: { model: 'user', key: 'id' } },
        can_view_payments: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        can_view_royalties: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        can_edit_artist_profile: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        status: { type: 'enum_artist_access_status', allowNull: false, defaultValue: 'Pending' },
        invite_hash: { type: Sequelize.STRING(255) },
      }, { transaction });

      await queryInterface.createTable('release_song', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        release_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'release', key: 'id' } },
        song_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'song', key: 'id' } },
        track_number: { type: Sequelize.INTEGER },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('song_collaborator', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        song_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'song', key: 'id' } },
        artist_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'artist', key: 'id' } },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('song_author', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        song_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'song', key: 'id' } },
        songwriter_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'songwriter', key: 'id' } },
        share_percentage: { type: Sequelize.DECIMAL(5, 2) },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('song_composer', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        song_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'song', key: 'id' } },
        songwriter_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'songwriter', key: 'id' } },
        share_percentage: { type: Sequelize.DECIMAL(5, 2) },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('sync_licensing_pitch_song', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        pitch_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'sync_licensing_pitch', key: 'id' } },
        song_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'song', key: 'id' } },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      // Transactional tables
      await queryInterface.createTable('ticket', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        event_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'event', key: 'id' } },
        ticket_type_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'ticket_type', key: 'id' } },
        name: { type: Sequelize.STRING(255), allowNull: false },
        email_address: { type: Sequelize.STRING(255), allowNull: false },
        contact_number: { type: Sequelize.STRING(45) },
        number_of_entries: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        number_of_claimed_entries: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        ticket_code: { type: Sequelize.STRING(5), allowNull: false },
        status: { type: 'enum_ticket_status', allowNull: false, defaultValue: 'New' },
        payment_link: { type: Sequelize.STRING(255) },
        payment_link_id: { type: Sequelize.STRING(45) },
        checkout_key: { type: Sequelize.STRING(100) },
        payment_id: { type: Sequelize.STRING(100) },
        price_per_ticket: { type: Sequelize.DECIMAL(10, 2) },
        payment_processing_fee: { type: Sequelize.DECIMAL(10, 2) },
        platform_fee: { type: Sequelize.DECIMAL(10, 2) },
        referrer_id: { type: Sequelize.INTEGER, references: { model: 'event_referrer', key: 'id' } },
        order_timestamp: { type: Sequelize.DATE },
        date_paid: { type: Sequelize.DATE },
      }, { transaction });

      await queryInterface.createTable('earning', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        release_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'release', key: 'id' } },
        type: { type: 'enum_earning_type', allowNull: false, defaultValue: 'Streaming' },
        amount: { type: Sequelize.DECIMAL(10, 2) },
        description: { type: Sequelize.STRING(255) },
        date_recorded: { type: Sequelize.DATEONLY, allowNull: false },
        platform_fee: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      }, { transaction });

      await queryInterface.createTable('royalty', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        artist_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'artist', key: 'id' } },
        earning_id: { type: Sequelize.INTEGER },
        percentage_of_earning: { type: Sequelize.DECIMAL(3, 3) },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        release_id: { type: Sequelize.INTEGER, references: { model: 'release', key: 'id' } },
        description: { type: Sequelize.STRING(255) },
        date_recorded: { type: Sequelize.DATEONLY, allowNull: false },
      }, { transaction });

      await queryInterface.createTable('payment', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        description: { type: Sequelize.STRING(45) },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        artist_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'artist', key: 'id' } },
        date_paid: { type: Sequelize.DATE, allowNull: false },
        paid_thru_type: { type: Sequelize.STRING(45) },
        paid_thru_account_name: { type: Sequelize.STRING(45) },
        paid_thru_account_number: { type: Sequelize.STRING(45) },
        payment_method_id: { type: Sequelize.INTEGER, references: { model: 'payment_method', key: 'id' } },
        reference_number: { type: Sequelize.STRING(100) },
        payment_processing_fee: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        status: { type: 'enum_payment_status', allowNull: false, defaultValue: 'succeeded' },
        paymongo_transfer_id: { type: Sequelize.STRING(100) },
        failure_reason: { type: Sequelize.TEXT },
      }, { transaction });

      await queryInterface.createTable('label_payment', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        description: { type: Sequelize.STRING(45) },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        brand_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'brand', key: 'id' } },
        date_paid: { type: Sequelize.DATE, allowNull: false },
        paid_thru_type: { type: Sequelize.STRING(45) },
        paid_thru_account_name: { type: Sequelize.STRING(45) },
        paid_thru_account_number: { type: Sequelize.STRING(45) },
        payment_method_id: { type: Sequelize.INTEGER, references: { model: 'label_payment_method', key: 'id' } },
        reference_number: { type: Sequelize.STRING(100) },
        payment_processing_fee: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
        status: { type: 'enum_payment_status', allowNull: false, defaultValue: 'succeeded' },
        paymongo_transfer_id: { type: Sequelize.STRING(100) },
        failure_reason: { type: Sequelize.TEXT },
      }, { transaction });

      await queryInterface.createTable('donation', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        fundraiser_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'fundraiser', key: 'id' } },
        name: { type: Sequelize.STRING(255), allowNull: false },
        email: { type: Sequelize.STRING(255), allowNull: false },
        contact_number: { type: Sequelize.STRING(45) },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        payment_status: { type: 'enum_donation_payment_status', allowNull: false, defaultValue: 'pending' },
        processing_fee: { type: Sequelize.DECIMAL(10, 2) },
        platform_fee: { type: Sequelize.DECIMAL(10, 2) },
        payment_reference: { type: Sequelize.STRING(255) },
        checkout_key: { type: Sequelize.STRING(100) },
        payment_id: { type: Sequelize.STRING(100) },
        anonymous: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        order_timestamp: { type: Sequelize.DATE },
        date_paid: { type: Sequelize.DATE },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('walk_in_transaction', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        event_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'event', key: 'id' } },
        payment_method: { type: 'enum_walk_in_payment_method', allowNull: false },
        payment_reference: { type: Sequelize.STRING(255) },
        total_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        registered_by: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'user', key: 'id' } },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('walk_in_transaction_item', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        walk_in_transaction_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'walk_in_transaction', key: 'id' } },
        walk_in_type_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'walk_in_type', key: 'id' } },
        quantity: { type: Sequelize.INTEGER, allowNull: false },
        price_per_unit: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('notification', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'user', key: 'id' } },
        brand_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'brand', key: 'id' } },
        type: { type: Sequelize.STRING(100), allowNull: false },
        title: { type: Sequelize.STRING(500), allowNull: false },
        message: { type: Sequelize.TEXT },
        link: { type: Sequelize.STRING(500) },
        is_read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('event_tag', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING(100), allowNull: false },
        is_custom: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        brand_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'brand', key: 'id' } },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      }, { transaction });

      await queryInterface.createTable('event_tag_mapping', {
        event_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, references: { model: 'event', key: 'id' } },
        tag_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, references: { model: 'event_tag', key: 'id' } },
      }, { transaction });

      // Log tables
      await queryInterface.createTable('login_attempt', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'user', key: 'id' } },
        status: { type: 'enum_login_attempt_status', allowNull: false },
        date_and_time: { type: Sequelize.DATE, allowNull: false },
        brand_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'brand', key: 'id' } },
        proxy_ip: { type: Sequelize.STRING(45) },
        remote_ip: { type: Sequelize.STRING(45) },
      }, { transaction });

      await queryInterface.createTable('email_attempt', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        recipients: { type: Sequelize.TEXT, allowNull: false },
        subject: { type: Sequelize.STRING(500), allowNull: false },
        body: { type: Sequelize.TEXT, allowNull: false },
        timestamp: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        result: { type: 'enum_email_attempt_result', allowNull: false },
        brand_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'brand', key: 'id' } },
      }, { transaction });

      await queryInterface.createTable('recuperable_expense', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        release_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'release', key: 'id' } },
        expense_description: { type: Sequelize.STRING(45), allowNull: false },
        expense_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        date_recorded: { type: Sequelize.DATEONLY },
        brand_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'brand', key: 'id' } },
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Drop in reverse order
      const tables = [
        'recuperable_expense', 'email_attempt', 'login_attempt',
        'notification',
        'walk_in_transaction_item', 'walk_in_transaction',
        'donation', 'label_payment', 'payment', 'royalty', 'earning', 'ticket',
        'sync_licensing_pitch_song', 'song_composer', 'song_author', 'song_collaborator',
        'release_song', 'artist_access', 'release_artist',
        'walk_in_type', 'event_referrer', 'ticket_type',
        'event_tag_mapping', 'event_tag',
        'artist_documents', 'artist_image',
        'label_payment_method', 'payment_method',
        'song', 'sync_licensing_pitch', 'fundraiser',
        'event', 'release', 'artist', 'domain', 'user',
        'songwriter', 'brand',
      ];

      for (const table of tables) {
        await queryInterface.dropTable(table, { transaction, cascade: true });
      }

      // Drop enum types
      const enumTypes = [
        'enum_walk_in_payment_method', 'enum_payment_status', 'enum_donation_payment_status',
        'enum_fundraiser_status', 'enum_fee_revenue_type', 'enum_earning_type',
        'enum_royalty_type', 'enum_email_attempt_result', 'enum_login_attempt_status',
        'enum_ticket_status', 'enum_event_type', 'enum_event_status', 'enum_event_countdown_display',
        'enum_release_status', 'enum_artist_access_status', 'enum_domain_status',
      ];

      for (const enumType of enumTypes) {
        await queryInterface.sequelize.query(`DROP TYPE IF EXISTS ${enumType} CASCADE`, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
