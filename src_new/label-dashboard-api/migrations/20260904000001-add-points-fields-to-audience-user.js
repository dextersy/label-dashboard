'use strict';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add columns idempotently using IF NOT EXISTS (safe to re-run after partial failure).
    //    referral_code is nullable initially so we can populate it before adding the unique index.
    await queryInterface.sequelize.query(`
      ALTER TABLE audience_user
        ADD COLUMN IF NOT EXISTS points_total INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10),
        ADD COLUMN IF NOT EXISTS referred_by_user_id INTEGER
          REFERENCES audience_user(id) ON UPDATE CASCADE ON DELETE SET NULL
    `);

    // 2. Backfill points_total from existing confirmed/sent tickets.
    //    +5 per paid ticket (price_per_ticket > 0), +3 per free ticket.
    //    Match by audience_user_id OR email address — many tickets pre-date the claim
    //    system and have a NULL audience_user_id even though the email matches.
    await queryInterface.sequelize.query(`
      UPDATE audience_user au
      SET points_total = (
        SELECT COALESCE(SUM(
          CASE WHEN t.price_per_ticket > 0 THEN 5 ELSE 3 END
        ), 0)
        FROM ticket t
        WHERE (
          t.audience_user_id = au.id
          OR LOWER(t.email_address) = LOWER(au.email_address)
        )
          AND t.status IN ('Payment Confirmed', 'Ticket sent.')
      )
    `);

    // 3. Generate unique referral codes for users that don't have one yet
    //    (handles both fresh runs and re-runs after a partial failure).
    const users = await queryInterface.sequelize.query(
      'SELECT id FROM audience_user WHERE referral_code IS NULL ORDER BY id',
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Seed usedCodes with any codes already assigned in a previous partial run
    const existing = await queryInterface.sequelize.query(
      'SELECT referral_code FROM audience_user WHERE referral_code IS NOT NULL',
      { type: Sequelize.QueryTypes.SELECT }
    );
    const usedCodes = new Set(existing.map((r) => r.referral_code));

    for (const user of users) {
      let code;
      let attempts = 0;
      do {
        code = generateCode();
        attempts++;
        if (attempts > 1000) throw new Error('Could not generate enough unique referral codes');
      } while (usedCodes.has(code));

      usedCodes.add(code);
      await queryInterface.sequelize.query(
        'UPDATE audience_user SET referral_code = ? WHERE id = ?',
        { replacements: [code, user.id] }
      );
    }

    // 4. Add unique index if it doesn't already exist.
    const indexes = await queryInterface.sequelize.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'audience_user'
         AND indexname = 'audience_user_referral_code_unique'`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    if (indexes.length === 0) {
      await queryInterface.addIndex('audience_user', ['referral_code'], {
        unique: true,
        name: 'audience_user_referral_code_unique',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('audience_user', 'audience_user_referral_code_unique');
    await queryInterface.removeColumn('audience_user', 'referred_by_user_id');
    await queryInterface.removeColumn('audience_user', 'referral_code');
    await queryInterface.removeColumn('audience_user', 'points_total');
  },
};
