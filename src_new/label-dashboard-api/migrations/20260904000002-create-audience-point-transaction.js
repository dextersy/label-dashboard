'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('[migration] Creating audience_point_transaction table...');
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS audience_point_transaction (
        id               SERIAL PRIMARY KEY,
        audience_user_id INTEGER NOT NULL REFERENCES audience_user(id) ON UPDATE CASCADE ON DELETE CASCADE,
        type             VARCHAR(20) NOT NULL CHECK (type IN ('ticket_purchase', 'event_share', 'referral')),
        points           INTEGER NOT NULL,
        reference_id     INTEGER,
        reference_type   VARCHAR(50),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('[migration] Table ready.');

    console.log('[migration] Creating indexes...');
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_apt_audience_user_id
        ON audience_point_transaction (audience_user_id)
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_apt_unique_award
        ON audience_point_transaction (audience_user_id, reference_id, reference_type, type)
        WHERE reference_id IS NOT NULL
    `);
    console.log('[migration] Indexes ready.');

    // ── Points precalculation ─────────────────────────────────────────────────

    const [userRows] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS total FROM audience_user`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    console.log(`[migration] audience_user row count: ${JSON.stringify(userRows)}`);

    const [ticketRows] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS total FROM ticket WHERE status IN ('Payment Confirmed', 'Ticket sent.')`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    console.log(`[migration] Eligible ticket row count: ${JSON.stringify(ticketRows)}`);

    // Sample a few tickets to verify column values
    const sampleTickets = await queryInterface.sequelize.query(
      `SELECT id, email_address, audience_user_id, price_per_ticket, status
         FROM ticket
        WHERE status IN ('Payment Confirmed', 'Ticket sent.')
        LIMIT 5`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    console.log(`[migration] Sample tickets: ${JSON.stringify(sampleTickets, null, 2)}`);

    // Sample a few audience users to verify email values
    const sampleUsers = await queryInterface.sequelize.query(
      `SELECT id, email_address, points_total FROM audience_user LIMIT 5`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    console.log(`[migration] Sample audience users (before update): ${JSON.stringify(sampleUsers, null, 2)}`);

    // Backfill: insert transaction rows for all eligible tickets that don't already
    // have one, then recalculate points_total from the transaction table.
    // Doing it this way (instead of a direct UPDATE on audience_user) ensures
    // points_total is always consistent with audience_point_transaction, so the
    // idempotency check in awardRetroactiveTicketPoints works correctly and
    // never double-counts.
    console.log('[migration] Inserting backfill transaction rows...');
    await queryInterface.sequelize.query(`
      INSERT INTO audience_point_transaction (audience_user_id, type, points, reference_id, reference_type, created_at)
      SELECT
        au.id,
        'ticket_purchase',
        CASE WHEN t.price_per_ticket > 0 THEN 5 ELSE 3 END,
        t.id,
        'ticket',
        NOW()
      FROM ticket t
      JOIN audience_user au ON (
        t.audience_user_id = au.id
        OR LOWER(t.email_address) = LOWER(au.email_address)
      )
      WHERE t.status IN ('Payment Confirmed', 'Ticket sent.')
      ON CONFLICT DO NOTHING
    `);
    console.log('[migration] Transaction rows inserted.');

    console.log('[migration] Recalculating points_total from transaction rows...');
    await queryInterface.sequelize.query(`
      UPDATE audience_user au
      SET points_total = (
        SELECT COALESCE(SUM(points), 0)
        FROM audience_point_transaction apt
        WHERE apt.audience_user_id = au.id
      )
    `);
    console.log('[migration] points_total recalculated.');

    const usersWithPoints = await queryInterface.sequelize.query(
      `SELECT id, email_address, points_total FROM audience_user WHERE points_total > 0`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    console.log(`[migration] Users with points > 0: ${JSON.stringify(usersWithPoints, null, 2)}`);

    console.log('[migration] Done.');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS audience_point_transaction');
  },
};
