'use strict';

module.exports = {
  async up(queryInterface) {
    console.log('[migration] Creating audience_notification table...');
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS audience_notification (
        id                SERIAL PRIMARY KEY,
        audience_user_id  INTEGER NOT NULL REFERENCES audience_user(id) ON UPDATE CASCADE ON DELETE CASCADE,
        type              VARCHAR(30) NOT NULL CHECK (type IN ('connection_request', 'connection_accepted', 'invite_joined')),
        title             VARCHAR(500) NOT NULL,
        message           TEXT,
        link              VARCHAR(500),
        actor_id          INTEGER REFERENCES audience_user(id) ON UPDATE CASCADE ON DELETE SET NULL,
        is_read           BOOLEAN NOT NULL DEFAULT FALSE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_an_audience_user_id ON audience_notification (audience_user_id)
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_an_unread ON audience_notification (audience_user_id, is_read)
    `);

    console.log('[migration] audience_notification ready.');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS audience_notification');
  },
};
