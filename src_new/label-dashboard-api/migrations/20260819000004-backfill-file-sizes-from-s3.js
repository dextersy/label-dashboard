'use strict';

require('dotenv').config();

const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Backfills file_size columns added in migration 20260819000003.
 *
 * For every S3-backed field that counts toward storage quota, this migration:
 *   1. Calls S3 HeadObject to retrieve the ContentLength.
 *   2. Writes the byte count back to the corresponding file_size column.
 *   3. If S3 returns 404 (object no longer exists), sets file_size to 0 and
 *      logs the missing reference to the console for manual review.
 *
 * Covered tables / fields:
 *   artist_image              path          → file_size
 *   artist_documents          path          → file_size
 *   release                   cover_art     → cover_art_file_size
 *   song                      audio_file    → audio_file_size
 *                             audio_file_mp3 → audio_file_mp3_size
 *   press_campaign            cover_art     → cover_art_file_size
 *                             mp3_file      → mp3_file_size
 *   press_campaign_artist_photo path        → file_size
 *
 * Note: song columns already existed; this migration only backfills rows
 * where audio_file_size / audio_file_mp3_size are currently NULL.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const missingVars = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'].filter(v => !process.env[v]);
    if (missingVars.length > 0) {
      throw new Error(
        `[backfill-file-sizes] Missing required environment variables: ${missingVars.join(', ')}.\n` +
        'Ensure these are set in the deployment environment before running this migration.'
      );
    }

    const BUCKET = process.env.S3_BUCKET;
    const MASTERS_BUCKET = process.env.S3_BUCKET_MASTERS;
    if (!MASTERS_BUCKET) {
      throw new Error(
        '[backfill-file-sizes] S3_BUCKET_MASTERS is not set.\n' +
        'This migration requires it to correctly size song master audio files.\n' +
        'Set S3_BUCKET_MASTERS in the deployment environment before running.'
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

    /**
     * HEAD an S3 object.
     * Returns ContentLength on success, null if not found, throws on other errors.
     */
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

    /**
     * Extract S3 key from a full URL or a bare key string.
     * Bare keys (no "http") are returned as-is.
     */
    function extractKey(urlOrKey) {
      if (!urlOrKey) return null;
      if (!urlOrKey.startsWith('http')) return urlOrKey;
      try {
        const url = new URL(urlOrKey);
        // Path-style:  /bucket/key  →  strip leading /bucket/
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts[0] === BUCKET || parts[0] === MASTERS_BUCKET) {
          return parts.slice(1).join('/');
        }
        // Virtual-hosted-style: the entire pathname is the key
        return url.pathname.replace(/^\//, '');
      } catch {
        return urlOrKey;
      }
    }

    // -----------------------------------------------------------------------
    // 1. artist_image.file_size
    // -----------------------------------------------------------------------
    {
      const rows = await queryInterface.sequelize.query(
        'SELECT id, path FROM artist_image WHERE path IS NOT NULL AND file_size IS NULL',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      for (const row of rows) {
        const key = extractKey(row.path);
        if (!key) continue;
        const size = await headObject(BUCKET, key);
        if (size === null) {
          missing.push({ table: 'artist_image', id: row.id, field: 'path', value: row.path });
          await queryInterface.sequelize.query(
            'UPDATE artist_image SET file_size = 0 WHERE id = :id',
            { replacements: { id: row.id } }
          );
        } else {
          await queryInterface.sequelize.query(
            'UPDATE artist_image SET file_size = :size WHERE id = :id',
            { replacements: { size, id: row.id } }
          );
        }
      }
    }

    // -----------------------------------------------------------------------
    // 2. artist_documents.file_size
    // -----------------------------------------------------------------------
    {
      const rows = await queryInterface.sequelize.query(
        'SELECT id, path FROM artist_documents WHERE path IS NOT NULL AND file_size IS NULL',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      for (const row of rows) {
        const key = extractKey(row.path);
        if (!key) continue;
        const size = await headObject(BUCKET, key);
        if (size === null) {
          missing.push({ table: 'artist_documents', id: row.id, field: 'path', value: row.path });
          await queryInterface.sequelize.query(
            'UPDATE artist_documents SET file_size = 0 WHERE id = :id',
            { replacements: { id: row.id } }
          );
        } else {
          await queryInterface.sequelize.query(
            'UPDATE artist_documents SET file_size = :size WHERE id = :id',
            { replacements: { size, id: row.id } }
          );
        }
      }
    }

    // -----------------------------------------------------------------------
    // 3. release.cover_art_file_size
    // -----------------------------------------------------------------------
    {
      const rows = await queryInterface.sequelize.query(
        'SELECT id, cover_art FROM release WHERE cover_art IS NOT NULL AND cover_art_file_size IS NULL',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      for (const row of rows) {
        const key = extractKey(row.cover_art);
        if (!key) continue;
        const size = await headObject(BUCKET, key);
        if (size === null) {
          missing.push({ table: 'release', id: row.id, field: 'cover_art', value: row.cover_art });
          await queryInterface.sequelize.query(
            'UPDATE release SET cover_art_file_size = 0 WHERE id = :id',
            { replacements: { id: row.id } }
          );
        } else {
          await queryInterface.sequelize.query(
            'UPDATE release SET cover_art_file_size = :size WHERE id = :id',
            { replacements: { size, id: row.id } }
          );
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. song.audio_file_size / audio_file_mp3_size (backfill NULL rows only)
    // -----------------------------------------------------------------------
    {
      const rows = await queryInterface.sequelize.query(
        'SELECT id, audio_file, audio_file_mp3, audio_file_size, audio_file_mp3_size FROM song WHERE audio_file IS NOT NULL OR audio_file_mp3 IS NOT NULL',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      for (const row of rows) {
        if (row.audio_file && row.audio_file_size === null) {
          const key = extractKey(row.audio_file);
          if (key) {
            const size = await headObject(MASTERS_BUCKET, key);
            if (size === null) {
              missing.push({ table: 'song', id: row.id, field: 'audio_file', value: row.audio_file });
              await queryInterface.sequelize.query(
                'UPDATE song SET audio_file_size = 0 WHERE id = :id',
                { replacements: { id: row.id } }
              );
            } else {
              await queryInterface.sequelize.query(
                'UPDATE song SET audio_file_size = :size WHERE id = :id',
                { replacements: { size, id: row.id } }
              );
            }
          }
        }
        if (row.audio_file_mp3 && row.audio_file_mp3_size === null) {
          const key = extractKey(row.audio_file_mp3);
          if (key) {
            const size = await headObject(MASTERS_BUCKET, key);
            if (size === null) {
              missing.push({ table: 'song', id: row.id, field: 'audio_file_mp3', value: row.audio_file_mp3 });
              await queryInterface.sequelize.query(
                'UPDATE song SET audio_file_mp3_size = 0 WHERE id = :id',
                { replacements: { id: row.id } }
              );
            } else {
              await queryInterface.sequelize.query(
                'UPDATE song SET audio_file_mp3_size = :size WHERE id = :id',
                { replacements: { size, id: row.id } }
              );
            }
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // 5. press_campaign.cover_art_file_size / mp3_file_size
    // -----------------------------------------------------------------------
    {
      const rows = await queryInterface.sequelize.query(
        'SELECT id, cover_art, mp3_file, cover_art_file_size, mp3_file_size FROM press_campaign WHERE cover_art IS NOT NULL OR mp3_file IS NOT NULL',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      for (const row of rows) {
        if (row.cover_art && row.cover_art_file_size === null) {
          const key = extractKey(row.cover_art);
          if (key) {
            const size = await headObject(BUCKET, key);
            if (size === null) {
              missing.push({ table: 'press_campaign', id: row.id, field: 'cover_art', value: row.cover_art });
              await queryInterface.sequelize.query(
                'UPDATE press_campaign SET cover_art_file_size = 0 WHERE id = :id',
                { replacements: { id: row.id } }
              );
            } else {
              await queryInterface.sequelize.query(
                'UPDATE press_campaign SET cover_art_file_size = :size WHERE id = :id',
                { replacements: { size, id: row.id } }
              );
            }
          }
        }
        if (row.mp3_file && row.mp3_file_size === null) {
          const key = extractKey(row.mp3_file);
          if (key) {
            const size = await headObject(BUCKET, key);
            if (size === null) {
              missing.push({ table: 'press_campaign', id: row.id, field: 'mp3_file', value: row.mp3_file });
              await queryInterface.sequelize.query(
                'UPDATE press_campaign SET mp3_file_size = 0 WHERE id = :id',
                { replacements: { id: row.id } }
              );
            } else {
              await queryInterface.sequelize.query(
                'UPDATE press_campaign SET mp3_file_size = :size WHERE id = :id',
                { replacements: { size, id: row.id } }
              );
            }
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // 6. press_campaign_artist_photo.file_size
    // -----------------------------------------------------------------------
    {
      const rows = await queryInterface.sequelize.query(
        'SELECT id, path FROM press_campaign_artist_photo WHERE path IS NOT NULL AND file_size IS NULL',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      for (const row of rows) {
        const key = extractKey(row.path);
        if (!key) continue;
        const size = await headObject(BUCKET, key);
        if (size === null) {
          missing.push({ table: 'press_campaign_artist_photo', id: row.id, field: 'path', value: row.path });
          await queryInterface.sequelize.query(
            'UPDATE press_campaign_artist_photo SET file_size = 0 WHERE id = :id',
            { replacements: { id: row.id } }
          );
        } else {
          await queryInterface.sequelize.query(
            'UPDATE press_campaign_artist_photo SET file_size = :size WHERE id = :id',
            { replacements: { size, id: row.id } }
          );
        }
      }
    }

    // -----------------------------------------------------------------------
    // Summary of missing S3 references
    // -----------------------------------------------------------------------
    if (missing.length > 0) {
      console.warn(`\n[backfill-file-sizes] ${missing.length} S3 reference(s) not found — file_size set to 0:`);
      for (const entry of missing) {
        console.warn(`  table=${entry.table} id=${entry.id} field=${entry.field} value=${entry.value}`);
      }
    } else {
      console.log('[backfill-file-sizes] All S3 references resolved successfully.');
    }
  },

  async down() {
    // Backfill data cannot be meaningfully reversed — the file_size columns
    // themselves are removed by the down() of migration 20260819000003.
  },
};
