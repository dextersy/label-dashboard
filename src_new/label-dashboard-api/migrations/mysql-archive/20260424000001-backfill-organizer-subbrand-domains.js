'use strict';

/**
 * Backfill organizer sub-brand domains.
 *
 * For every brand whose parent_brand is TICKETING_PARENT_BRAND_ID, delete all
 * existing domain rows and insert a single primary domain that matches the
 * parent brand's current primary domain.
 *
 * Run this after changing the parent brand's primary domain in the label
 * dashboard so that all sub-brands inherit the correct domain for ticket
 * buy/verify link generation.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;

    const parentBrandId = process.env.TICKETING_PARENT_BRAND_ID
      ? parseInt(process.env.TICKETING_PARENT_BRAND_ID, 10)
      : null;

    if (!parentBrandId) {
      console.warn('[backfill-organizer-subbrand-domains] TICKETING_PARENT_BRAND_ID is not set — skipping migration.');
      return;
    }

    console.log(`[backfill-organizer-subbrand-domains] Using parent brand ID: ${parentBrandId}`);

    // Resolve the parent brand's primary domain
    const [parentDomains] = await queryInterface.sequelize.query(
      `SELECT domain_name, status FROM domain WHERE brand_id = ? ORDER BY is_primary DESC, domain_name ASC LIMIT 1`,
      { replacements: [parentBrandId], type: QueryTypes.SELECT }
    );

    if (!parentDomains) {
      throw new Error(`[backfill-organizer-subbrand-domains] No domain found for parent brand ID ${parentBrandId}. Aborting.`);
    }

    const { domain_name: domainName, status } = parentDomains;
    console.log(`[backfill-organizer-subbrand-domains] Parent primary domain: ${domainName} (status: ${status})`);

    // Find all organizer sub-brands
    const subBrands = await queryInterface.sequelize.query(
      `SELECT id, brand_name FROM brand WHERE parent_brand = ?`,
      { replacements: [parentBrandId], type: QueryTypes.SELECT }
    );

    console.log(`[backfill-organizer-subbrand-domains] Found ${subBrands.length} organizer sub-brand(s).`);

    let updated = 0;

    for (const brand of subBrands) {
      // Delete all existing domain rows for this sub-brand
      await queryInterface.sequelize.query(
        `DELETE FROM domain WHERE brand_id = ?`,
        { replacements: [brand.id], type: QueryTypes.DELETE }
      );

      // Insert the parent's primary domain as this sub-brand's primary domain
      await queryInterface.sequelize.query(
        `INSERT INTO domain (brand_id, domain_name, status, is_primary) VALUES (?, ?, ?, 1)`,
        { replacements: [brand.id, domainName, status], type: QueryTypes.INSERT }
      );

      console.log(`  [${brand.id}] ${brand.brand_name} → set domain to ${domainName}`);
      updated++;
    }

    console.log(`[backfill-organizer-subbrand-domains] Done. Updated ${updated} sub-brand(s).`);
  },

  async down(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;

    const parentBrandId = process.env.TICKETING_PARENT_BRAND_ID
      ? parseInt(process.env.TICKETING_PARENT_BRAND_ID, 10)
      : null;

    if (!parentBrandId) {
      console.warn('[backfill-organizer-subbrand-domains] TICKETING_PARENT_BRAND_ID is not set — skipping rollback.');
      return;
    }

    // On rollback: remove all domain rows from organizer sub-brands.
    // We cannot restore the previous state without a snapshot, so we simply
    // clear the domains — same as before the original signup fix was applied.
    const subBrands = await queryInterface.sequelize.query(
      `SELECT id FROM brand WHERE parent_brand = ?`,
      { replacements: [parentBrandId], type: QueryTypes.SELECT }
    );

    for (const brand of subBrands) {
      await queryInterface.sequelize.query(
        `DELETE FROM domain WHERE brand_id = ?`,
        { replacements: [brand.id], type: QueryTypes.DELETE }
      );
    }

    console.log(`[backfill-organizer-subbrand-domains] Rollback: removed domain rows for ${subBrands.length} sub-brand(s).`);
  }
};
