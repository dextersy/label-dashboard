'use strict';

const PREDEFINED_TAGS = [
  'Live Music', 'Hip-Hop', 'Electronic', 'Jazz', 'Indie',
  'Rock', 'Pop', 'R&B', 'Acoustic', 'Underground',
  '18+', 'All Ages', 'Outdoor', 'Indoor', 'Free Entry'
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = PREDEFINED_TAGS.map(name => ({
      name,
      is_custom: false,
      brand_id: null,
      createdAt: now,
      updatedAt: now
    }));
    await queryInterface.bulkInsert('event_tag', rows, {});
  },

  async down(queryInterface) {
    const { Op } = require('sequelize');
    await queryInterface.bulkDelete('event_tag', {
      name: { [Op.in]: PREDEFINED_TAGS },
      brand_id: null
    }, {});
  }
};
