'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop the single-column primary key on event_id
    await queryInterface.sequelize.query(
      'ALTER TABLE event_access DROP CONSTRAINT IF EXISTS event_access_pkey'
    );

    // Add the composite primary key on (event_id, user_id)
    await queryInterface.sequelize.query(
      'ALTER TABLE event_access ADD PRIMARY KEY (event_id, user_id)'
    );
  },

  async down(queryInterface, Sequelize) {
    // Revert to single-column primary key on event_id
    await queryInterface.sequelize.query(
      'ALTER TABLE event_access DROP CONSTRAINT IF EXISTS event_access_pkey'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE event_access ADD PRIMARY KEY (event_id)'
    );
  },
};
