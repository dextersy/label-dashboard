'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // royalty indexes
    await queryInterface.addIndex('royalty', ['artist_id'], {
      name: 'idx_royalty_artist_id',
      ifNotExists: true,
    }).catch(() => {});
    await queryInterface.addIndex('royalty', ['earning_id'], {
      name: 'idx_royalty_earning_id',
      ifNotExists: true,
    }).catch(() => {});
    await queryInterface.addIndex('royalty', ['release_id'], {
      name: 'idx_royalty_release_id',
      ifNotExists: true,
    }).catch(() => {});
    await queryInterface.addIndex('royalty', ['date_recorded'], {
      name: 'idx_royalty_date_recorded',
      ifNotExists: true,
    }).catch(() => {});

    // payment indexes
    await queryInterface.addIndex('payment', ['artist_id'], {
      name: 'idx_payment_artist_id',
      ifNotExists: true,
    }).catch(() => {});
    await queryInterface.addIndex('payment', ['artist_id', 'status'], {
      name: 'idx_payment_artist_id_status',
      ifNotExists: true,
    }).catch(() => {});
    await queryInterface.addIndex('payment', ['paid_by_brand_id', 'artist_id', 'status'], {
      name: 'idx_payment_brand_artist_status',
      ifNotExists: true,
    }).catch(() => {});
    await queryInterface.addIndex('payment', ['date_paid'], {
      name: 'idx_payment_date_paid',
      ifNotExists: true,
    }).catch(() => {});

    // recuperable_expense indexes
    await queryInterface.addIndex('recuperable_expense', ['release_id'], {
      name: 'idx_recuperable_expense_release_id',
      ifNotExists: true,
    }).catch(() => {});
    await queryInterface.addIndex('recuperable_expense', ['brand_id', 'release_id'], {
      name: 'idx_recuperable_expense_brand_release',
      ifNotExists: true,
    }).catch(() => {});
    await queryInterface.addIndex('recuperable_expense', ['release_id', 'date_recorded'], {
      name: 'idx_recuperable_expense_release_date',
      ifNotExists: true,
    }).catch(() => {});

    // earning indexes
    await queryInterface.addIndex('earning', ['release_id'], {
      name: 'idx_earning_release_id',
      ifNotExists: true,
    }).catch(() => {});
    await queryInterface.addIndex('earning', ['recorded_by_brand_id'], {
      name: 'idx_earning_recorded_by_brand_id',
      ifNotExists: true,
    }).catch(() => {});
    await queryInterface.addIndex('earning', ['date_recorded'], {
      name: 'idx_earning_date_recorded',
      ifNotExists: true,
    }).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    const indexes = [
      ['royalty', 'idx_royalty_artist_id'],
      ['royalty', 'idx_royalty_earning_id'],
      ['royalty', 'idx_royalty_release_id'],
      ['royalty', 'idx_royalty_date_recorded'],
      ['payment', 'idx_payment_artist_id'],
      ['payment', 'idx_payment_artist_id_status'],
      ['payment', 'idx_payment_brand_artist_status'],
      ['payment', 'idx_payment_date_paid'],
      ['recuperable_expense', 'idx_recuperable_expense_release_id'],
      ['recuperable_expense', 'idx_recuperable_expense_brand_release'],
      ['recuperable_expense', 'idx_recuperable_expense_release_date'],
      ['earning', 'idx_earning_release_id'],
      ['earning', 'idx_earning_recorded_by_brand_id'],
      ['earning', 'idx_earning_date_recorded'],
    ];
    for (const [table, name] of indexes) {
      await queryInterface.removeIndex(table, name).catch(() => {});
    }
  },
};
