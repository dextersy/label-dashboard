'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Starting platform fee backfill for live events...');
    
    try {
      const { QueryTypes } = Sequelize;
      
      // Find all live events (event_date > current date) with their brand info
      const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      const liveEventsQuery = `
        SELECT 
          e.id,
          e.title,
          e.date_and_time,
          e.brand_id,
          b.brand_name,
          b.event_transaction_fixed_fee,
          b.event_revenue_percentage_fee,
          b.event_fee_revenue_type
        FROM event e
        JOIN brand b ON e.brand_id = b.id
        WHERE e.date_and_time > ?
        ORDER BY e.date_and_time ASC
      `;
      
      const liveEvents = await queryInterface.sequelize.query(liveEventsQuery, {
        replacements: [currentDate],
        type: QueryTypes.SELECT
      });
      
      console.log(`Found ${liveEvents.length} live events to process`);
      
      let totalEventsProcessed = 0;
      let totalTicketsUpdated = 0;
      let grandTotalPlatformFees = 0;
      
      // Process each live event
      for (const event of liveEvents) {
        console.log(`\nProcessing Event: ${event.title} (ID: ${event.id}) - Date: ${event.date_and_time}`);
        
        // Find all confirmed/sent tickets for this event that don't have platform_fee set
        const ticketsQuery = `
          SELECT 
            id,
            price_per_ticket,
            number_of_entries,
            payment_processing_fee,
            platform_fee
          FROM ticket
          WHERE event_id = ? 
          AND status IN ('Payment Confirmed', 'Ticket sent.')
          AND (platform_fee IS NULL OR platform_fee = 0)
        `;
        
        const tickets = await queryInterface.sequelize.query(ticketsQuery, {
          replacements: [event.id],
          type: QueryTypes.SELECT
        });
        
        if (tickets.length === 0) {
          console.log(`  No tickets to update for event: ${event.title}`);
          continue;
        }
        
        console.log(`  Found ${tickets.length} tickets to update`);
        
        let eventTotalPlatformFees = 0;
        let eventTicketsUpdated = 0;
        
        // Process each ticket
        for (const ticket of tickets) {
          try {
            // Calculate platform fee for this ticket
            const pricePerTicket = parseFloat(ticket.price_per_ticket) || 0;
            const numberOfEntries = parseInt(ticket.number_of_entries) || 1;
            const paymentProcessingFee = parseFloat(ticket.payment_processing_fee) || 0;
            
            // Calculate gross revenue (price of tickets times number of entries)
            const grossRevenue = pricePerTicket * numberOfEntries;
            
            // Calculate net revenue (gross minus processing fees, then subtract 0.5%)
            const afterProcessingFees = grossRevenue - paymentProcessingFee;
            const netRevenue = afterProcessingFees - (afterProcessingFees * 0.005); // Subtract 0.5%
            
            let fixedFee = 0;
            let percentageFee = 0;
            
            // 1. Fixed fee per transaction
            if (event.event_transaction_fixed_fee && event.event_transaction_fixed_fee > 0) {
              fixedFee = parseFloat(event.event_transaction_fixed_fee);
            }
            
            // 2. Percentage fee calculation
            if (event.event_revenue_percentage_fee && event.event_revenue_percentage_fee > 0) {
              if (event.event_fee_revenue_type === 'gross') {
                // Apply percentage to gross revenue
                percentageFee = (grossRevenue * parseFloat(event.event_revenue_percentage_fee)) / 100;
              } else if (event.event_fee_revenue_type === 'net') {
                // Apply percentage to net revenue
                percentageFee = (netRevenue * parseFloat(event.event_revenue_percentage_fee)) / 100;
              }
            }
            
            const totalPlatformFee = parseFloat((fixedFee + percentageFee).toFixed(2));
            
            // Update the ticket with the calculated platform fee
            await queryInterface.sequelize.query(
              'UPDATE ticket SET platform_fee = ? WHERE id = ?',
              {
                replacements: [totalPlatformFee, ticket.id],
                type: QueryTypes.UPDATE
              }
            );
            
            eventTotalPlatformFees += totalPlatformFee;
            eventTicketsUpdated++;
            
            console.log(`    Ticket ID ${ticket.id}: ₱${totalPlatformFee.toFixed(2)} platform fee`);
            
          } catch (error) {
            console.error(`    Error processing ticket ID ${ticket.id}:`, error.message);
          }
        }
        
        // Log event summary
        console.log(`  Event Summary:`);
        console.log(`    - Tickets updated: ${eventTicketsUpdated}`);
        console.log(`    - Total platform fees calculated: ₱${eventTotalPlatformFees.toFixed(2)}`);
        
        totalEventsProcessed++;
        totalTicketsUpdated += eventTicketsUpdated;
        grandTotalPlatformFees += eventTotalPlatformFees;
      }
      
      // Final summary
      console.log(`\n==================== MIGRATION SUMMARY ====================`);
      console.log(`Total live events processed: ${totalEventsProcessed}`);
      console.log(`Total tickets updated: ${totalTicketsUpdated}`);
      console.log(`Grand total platform fees calculated: ₱${grandTotalPlatformFees.toFixed(2)}`);
      console.log(`Platform fee backfill migration completed successfully!`);
      console.log(`============================================================\n`);
      
    } catch (error) {
      console.error('Error during platform fee backfill migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // In the down migration, we could reset platform_fee to null for live events
    // but this might not be desirable as it would remove calculated data
    console.log('Down migration: Resetting platform_fee to null for live event tickets...');
    
    try {
      const { QueryTypes } = Sequelize;
      
      // Find all live events
      const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      const liveEventsQuery = `
        SELECT id
        FROM event
        WHERE date_and_time > ?
      `;
      
      const liveEvents = await queryInterface.sequelize.query(liveEventsQuery, {
        replacements: [currentDate],
        type: QueryTypes.SELECT
      });
      
      if (liveEvents.length > 0) {
        const eventIds = liveEvents.map(event => event.id);
        
        // Reset platform_fee to null for tickets of live events
        const updateQuery = `
          UPDATE ticket 
          SET platform_fee = NULL 
          WHERE event_id IN (${eventIds.join(',')}) 
          AND status IN ('Payment Confirmed', 'Ticket sent.')
        `;
        
        const [results, metadata] = await queryInterface.sequelize.query(updateQuery);
        
        console.log(`Reset platform_fee for ${metadata.affectedRows || metadata.rowCount || 'unknown'} tickets in live events`);
      } else {
        console.log('No live events found, nothing to reset');
      }
      
    } catch (error) {
      console.error('Error during platform fee backfill rollback:', error);
      throw error;
    }
  }
};