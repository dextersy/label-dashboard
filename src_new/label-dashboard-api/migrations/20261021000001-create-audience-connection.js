'use strict';

module.exports = {
  async up(queryInterface) {
    console.log('[migration] Creating audience_connection table...');
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS audience_connection (
        id            SERIAL PRIMARY KEY,
        requester_id  INTEGER NOT NULL REFERENCES audience_user(id) ON UPDATE CASCADE ON DELETE CASCADE,
        addressee_id  INTEGER NOT NULL REFERENCES audience_user(id) ON UPDATE CASCADE ON DELETE CASCADE,
        status        VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_audience_connection UNIQUE (requester_id, addressee_id),
        CONSTRAINT chk_no_self_connect CHECK (requester_id <> addressee_id)
      )
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_ac_addressee_id ON audience_connection (addressee_id)
    `);

    console.log('[migration] audience_connection ready.');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS audience_connection');
  },
};
