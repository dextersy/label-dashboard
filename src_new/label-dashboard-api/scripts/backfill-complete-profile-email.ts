/**
 * Backfill: send "complete your profile — earn 10 points" email to all verified
 * audience users who have not yet filled in all of their extended profile fields
 * (city, country, date_of_birth, gender_identity, music_genres, event_frequency).
 *
 * Respects each user's marketing_promos email preference (skips if opted out).
 * Already-complete profiles are skipped automatically.
 *
 * Usage:
 *   npx ts-node scripts/backfill-complete-profile-email.ts
 *
 * Options (env vars):
 *   DELAY_MS    — ms between emails, default 500 (to avoid SMTP throttling)
 *   DRY_RUN=true — print who would be emailed without actually sending
 *   LIMIT       — max number of users to process in one run (default: all)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import * as fs from 'fs';
import nodemailer from 'nodemailer';
import { Sequelize, Op } from 'sequelize';

const DRY_RUN = process.env.DRY_RUN === 'true';
const DELAY_MS = parseInt(process.env.DELAY_MS || '500', 10);
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;

const PLATFORM_NAME = process.env.PLATFORM_NAME || 'Your Scene';
const AUDIENCE_APP_URL = process.env.AUDIENCE_APP_URL || '';
const TICKETING_FRONTEND_URL = process.env.TICKETING_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:4201';

// ─── Bootstrap Sequelize directly (don't import src models to avoid full app init) ───

const sequelize = new Sequelize(process.env.DATABASE_URL || '', {
  dialect: 'postgres',
  logging: false,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
} as any);

// ─── Raw queries to avoid importing the full model tree ───────────────────────

async function getUsersNeedingEmail(): Promise<any[]> {
  const [rows] = await sequelize.query(`
    SELECT
      au.id,
      au.email_address,
      au.first_name,
      au.city,
      au.country,
      au.date_of_birth,
      au.gender_identity,
      au.music_genres,
      au.event_frequency,
      aep.marketing_promos
    FROM audience_user au
    LEFT JOIN audience_email_preference aep ON aep.audience_user_id = au.id
    WHERE
      au.email_verified = true
      AND (
        au.city IS NULL
        OR au.country IS NULL
        OR au.date_of_birth IS NULL
        OR au.gender_identity IS NULL
        OR au.music_genres IS NULL
        OR array_length(au.music_genres, 1) IS NULL
        OR au.event_frequency IS NULL
      )
      -- Skip if user has explicitly opted out of marketing emails
      AND (aep.marketing_promos IS NULL OR aep.marketing_promos = true)
    ORDER BY au.id ASC
    ${LIMIT ? `LIMIT ${LIMIT}` : ''}
  `);
  return rows as any[];
}

// ─── Email ────────────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// In production, assets are compiled to api-server/assets (no src/ prefix).
// In local dev (ts-node from source), fall back to src/assets.
const templatePath = (() => {
  const prod = path.join(__dirname, '../assets/templates/audience_complete_profile_email.html');
  const dev  = path.join(__dirname, '../src/assets/templates/audience_complete_profile_email.html');
  return fs.existsSync(prod) ? prod : dev;
})();
const templateHtml = fs.readFileSync(templatePath, 'utf-8');

async function sendEmail(user: any): Promise<void> {
  const profileUrl = `${TICKETING_FRONTEND_URL}/my-profile`;
  const notificationsUrl = `${TICKETING_FRONTEND_URL}/my-notifications`;
  const logoUrl = `${AUDIENCE_APP_URL}/assets/logo-dark-bg.png`;

  const html = templateHtml
    .replace(/%PLATFORM_NAME%/g, PLATFORM_NAME)
    .replace(/%FIRST_NAME%/g, user.first_name || 'there')
    .replace(/%LOGO_URL%/g, logoUrl)
    .replace(/%PROFILE_URL%/g, profileUrl)
    .replace(/%NOTIFICATIONS_URL%/g, notificationsUrl);

  await transporter.sendMail({
    from: `${PLATFORM_NAME} <${process.env.FROM_EMAIL}>`,
    to: user.email_address,
    subject: `Complete your profile — earn 10 points`,
    html,
  });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Backfill: complete-profile email`);
  console.log(`   DRY_RUN=${DRY_RUN}  DELAY_MS=${DELAY_MS}  LIMIT=${LIMIT ?? 'all'}\n`);

  await sequelize.authenticate();
  console.log('✅ DB connected\n');

  const users = await getUsersNeedingEmail();
  console.log(`Found ${users.length} user(s) to email.\n`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would email: ${user.email_address} (id=${user.id})`);
      sent++;
      continue;
    }

    try {
      await sendEmail(user);
      console.log(`  ✉️  Sent to ${user.email_address} (id=${user.id})`);
      sent++;
    } catch (err: any) {
      console.error(`  ❌ Failed for ${user.email_address}: ${err.message}`);
      failed++;
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  console.log(`\n✅ Done. Sent=${sent}  Skipped=${skipped}  Failed=${failed}`);
  await sequelize.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
