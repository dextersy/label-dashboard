'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE audience_user
        ADD COLUMN IF NOT EXISTS city VARCHAR(100),
        ADD COLUMN IF NOT EXISTS country VARCHAR(2),
        ADD COLUMN IF NOT EXISTS date_of_birth DATE,
        ADD COLUMN IF NOT EXISTS gender_identity VARCHAR(30),
        ADD COLUMN IF NOT EXISTS music_genres VARCHAR(50)[],
        ADD COLUMN IF NOT EXISTS event_frequency VARCHAR(20)
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('audience_user', 'event_frequency');
    await queryInterface.removeColumn('audience_user', 'music_genres');
    await queryInterface.removeColumn('audience_user', 'gender_identity');
    await queryInterface.removeColumn('audience_user', 'date_of_birth');
    await queryInterface.removeColumn('audience_user', 'country');
    await queryInterface.removeColumn('audience_user', 'city');
  },
};
