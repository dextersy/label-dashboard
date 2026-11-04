'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // wristband_order: add public-order fields (no delivery or checkout fields — those live elsewhere)
    await queryInterface.addColumn('wristband_order', 'is_public', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('wristband_order', 'public_token', {
      type: Sequelize.UUID,
      allowNull: true,
      unique: true,
    });
    await queryInterface.addColumn('wristband_order', 'customer_name', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
    await queryInterface.addColumn('wristband_order', 'customer_email', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    // wristband_order: make created_by nullable (public orders have no initiating user)
    await queryInterface.changeColumn('wristband_order', 'created_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // event: make brand_id nullable (dummy events for public orders have no brand)
    await queryInterface.changeColumn('event', 'brand_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // event_addon_payment: make created_by nullable (public order payments have no initiating user)
    await queryInterface.changeColumn('event_addon_payment', 'created_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('event_addon_payment', 'created_by', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
    await queryInterface.changeColumn('event', 'brand_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
    await queryInterface.changeColumn('wristband_order', 'created_by', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
    await queryInterface.removeColumn('wristband_order', 'customer_email');
    await queryInterface.removeColumn('wristband_order', 'customer_name');
    await queryInterface.removeColumn('wristband_order', 'public_token');
    await queryInterface.removeColumn('wristband_order', 'is_public');
  },
};
