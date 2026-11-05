'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // event.brand_id — used in getEvents WHERE brand_id = ? and ORDER BY date_and_time DESC
    await queryInterface.addIndex('event', ['brand_id'], {
      name: 'idx_event_brand_id',
      ifNotExists: true,
    }).catch(() => {});

    // event.brand_id + date_and_time — covers the ORDER BY in the same scan
    await queryInterface.addIndex('event', ['brand_id', 'date_and_time'], {
      name: 'idx_event_brand_id_date',
      ifNotExists: true,
    }).catch(() => {});

    // event_brand_collaborations(brand_id, status) — first query run on every getEvents call
    await queryInterface.addIndex('event_brand_collaborations', ['brand_id', 'status'], {
      name: 'idx_event_brand_collab_brand_status',
      ifNotExists: true,
    }).catch(() => {});

    // event_brand_collaborations(event_id) — used when resolving collab event IDs
    await queryInterface.addIndex('event_brand_collaborations', ['event_id'], {
      name: 'idx_event_brand_collab_event_id',
      ifNotExists: true,
    }).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    const indexes = [
      ['event', 'idx_event_brand_id'],
      ['event', 'idx_event_brand_id_date'],
      ['event_brand_collaborations', 'idx_event_brand_collab_brand_status'],
      ['event_brand_collaborations', 'idx_event_brand_collab_event_id'],
    ];
    for (const [table, name] of indexes) {
      await queryInterface.removeIndex(table, name).catch(() => {});
    }
  },
};
