'use strict';

require('dotenv').config();

const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Retries the S3 file-size backfill for any row where file_size is NULL or 0.
 *
 * Migration 20260819000004 set file_size = 0 for objects that returned 404,
 * but many of those 404s were caused by a URL-decode bug: url.pathname retains
 * percent-encoding (e.g. %20), so HeadObjectCommand received an encoded key
 * while the actual S3 key contains literal spaces. This migration decodes the
 * key before calling HeadObject, which resolves those false 404s.
 *
 * Rows that genuinely no longer exist in S3 are left at 0 and logged.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const missingVars = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'].filter(v => !process.env[v]);
    if (missingVars.length > 0) {
      throw new Error(
        `[retry-backfill-file-sizes] Missing required environment variables: ${missingVars.join(', ')}.\n` +
        'Ensure these are set in the deployment environment before running this migration.'
      );
    }

    const BUCKET = process.env.S3_BUCKET;
    const MASTERS_BUCKET = process.env.S3_BUCKET_MASTERS;
    if (!MASTERS_BUCKET) {
      throw new Error(
        '[retry-backfill-file-sizes] S3_BUCKET_MASTERS is not set.\n' +
        'Set it in the deployment environment before running.'
      );
    }

    const s3Config = {
      region: process.env.S3_REGION,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      },
    };
    if (process.env.S3_ENDPOINT) {
      s3Config.endpoint = process.env.S3_ENDPOINT;
      s3Config.forcePathStyle = true;
    }
    const s3 = new S3Client(s3Config);

    const missing = [];

    async function headObject(bucket, key) {
      try {
        const res = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return res.ContentLength ?? null;
      } catch (err) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          return null;
        }
        throw err;
      }
    }

    function extractKey(urlOrKey) {
      if (!urlOrKey) return null;
      if (!urlOrKey.startsWith('http')) return urlOrKey;
      try {
        const url = new URL(urlOrKey);
        // url.pathname is still percent-encoded — decode it so the S3 key matches
        const decoded = decodeURIComponent(url.pathname.replace(/^\//, ''));
        // Path-style URL: /bucket/key — strip the bucket prefix
        const parts = decoded.split('/');
        if (parts[0] === BUCKET || parts[0] === MASTERS_BUCKET) {
          return parts.slice(1).join('/');
        }
        // Virtual-hosted-style: entire pathname is the key
        return decoded;
      } catch {
        return urlOrKey;
      }
    }

    async function backfill({ table, field, sizeField, bucket, where }) {
      const rows = await queryInterface.sequelize.query(
        `SELECT id, ${field} AS file_ref FROM ${table} WHERE ${field} IS NOT NULL AND (${sizeField} IS NULL OR ${sizeField} = 0)${where ? ' AND ' + where : ''}`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );

      console.log(`[retry-backfill-file-sizes] ${table}.${sizeField}: ${rows.length} row(s) to retry`);

      let updated = 0;
      for (const row of rows) {
        const key = extractKey(row.file_ref);
        if (!key) continue;
        const size = await headObject(bucket, key);
        if (size === null) {
          missing.push({ table, id: row.id, field, value: row.file_ref });
          await queryInterface.sequelize.query(
            `UPDATE ${table} SET ${sizeField} = 0 WHERE id = :id`,
            { replacements: { id: row.id } }
          );
        } else {
          await queryInterface.sequelize.query(
            `UPDATE ${table} SET ${sizeField} = :size WHERE id = :id`,
            { replacements: { size, id: row.id } }
          );
          updated++;
        }
      }

      console.log(`[retry-backfill-file-sizes] ${table}.${sizeField}: ${updated} updated, ${rows.length - updated} still missing`);
    }

    await backfill({ table: 'artist_image',               field: 'path',          sizeField: 'file_size',            bucket: BUCKET });
    await backfill({ table: 'artist_documents',            field: 'path',          sizeField: 'file_size',            bucket: BUCKET });
    await backfill({ table: 'release',                     field: 'cover_art',     sizeField: 'cover_art_file_size',  bucket: BUCKET });
    await backfill({ table: 'song',                        field: 'audio_file',    sizeField: 'audio_file_size',      bucket: MASTERS_BUCKET });
    await backfill({ table: 'song',                        field: 'audio_file_mp3',sizeField: 'audio_file_mp3_size',  bucket: BUCKET });
    await backfill({ table: 'press_campaign',              field: 'cover_art',     sizeField: 'cover_art_file_size',  bucket: BUCKET });
    await backfill({ table: 'press_campaign',              field: 'mp3_file',      sizeField: 'mp3_file_size',        bucket: BUCKET });
    await backfill({ table: 'press_campaign_artist_photo', field: 'path',          sizeField: 'file_size',            bucket: BUCKET });

    if (missing.length > 0) {
      console.warn(`\n[retry-backfill-file-sizes] ${missing.length} S3 reference(s) still not found — file_size left at 0:`);
      for (const entry of missing) {
        console.warn(`  table=${entry.table} id=${entry.id} field=${entry.field} value=${entry.value}`);
      }
    } else {
      console.log('\n[retry-backfill-file-sizes] All references resolved successfully.');
    }
  },

  async down() {
    // No rollback — file sizes are derived data; re-run up() to refresh.
  },
};
