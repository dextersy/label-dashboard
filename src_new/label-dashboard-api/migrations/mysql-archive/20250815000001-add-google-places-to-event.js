'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('event');
    
    // Add Google Places ID for referencing the place
    if (!tableInfo.google_place_id) {
      await queryInterface.addColumn('event', 'google_place_id', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Google Places API place ID'
      });
    }
    
    // Add formatted address from Google Places
    if (!tableInfo.venue_address) {
      await queryInterface.addColumn('event', 'venue_address', {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Full formatted address from Google Places'
      });
    }
    
    // Add latitude for mapping
    if (!tableInfo.venue_latitude) {
      await queryInterface.addColumn('event', 'venue_latitude', {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
        comment: 'Venue latitude coordinate'
      });
    }
    
    // Add longitude for mapping
    if (!tableInfo.venue_longitude) {
      await queryInterface.addColumn('event', 'venue_longitude', {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
        comment: 'Venue longitude coordinate'
      });
    }
    
    // Add phone number if available from Google Places
    if (!tableInfo.venue_phone) {
      await queryInterface.addColumn('event', 'venue_phone', {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Venue phone number from Google Places'
      });
    }
    
    // Add website URL if available from Google Places
    if (!tableInfo.venue_website) {
      await queryInterface.addColumn('event', 'venue_website', {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Venue website URL from Google Places'
      });
    }
    
    // Add Google Maps URL for easy linking
    if (!tableInfo.venue_maps_url) {
      await queryInterface.addColumn('event', 'venue_maps_url', {
        type: Sequelize.STRING(1000),
        allowNull: true,
        comment: 'Google Maps URL for the venue'
      });
    }
    
    console.log('Added Google Places columns to event table');
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('event');
    
    // Remove columns in reverse order
    if (tableInfo.venue_maps_url) {
      await queryInterface.removeColumn('event', 'venue_maps_url');
    }
    
    if (tableInfo.venue_website) {
      await queryInterface.removeColumn('event', 'venue_website');
    }
    
    if (tableInfo.venue_phone) {
      await queryInterface.removeColumn('event', 'venue_phone');
    }
    
    if (tableInfo.venue_longitude) {
      await queryInterface.removeColumn('event', 'venue_longitude');
    }
    
    if (tableInfo.venue_latitude) {
      await queryInterface.removeColumn('event', 'venue_latitude');
    }
    
    if (tableInfo.venue_address) {
      await queryInterface.removeColumn('event', 'venue_address');
    }
    
    if (tableInfo.google_place_id) {
      await queryInterface.removeColumn('event', 'google_place_id');
    }
    
    console.log('Removed Google Places columns from event table');
  }
};