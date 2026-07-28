/**
 * Populate AI summaries for all songs that don't have one yet.
 *
 * For each song, downloads the MP3 from S3, runs Essentia.js audio feature
 * extraction (key, energy, danceability, dynamics), combines with any manually
 * entered lyrics, then calls Groq to produce a sync-licensing description.
 *
 * Rate limiting strategy (conservative, fits Groq free tier):
 *   - 1 request every 8 seconds = ~7-8 RPM (limit: 30 RPM)
 *   - Each Groq request uses ~400-700 tokens (limit: 6,000 TPM)
 *   - On 429, backs off exponentially before retrying
 *
 * Usage:
 *   npx ts-node scripts/populate-song-ai-summaries.ts
 *
 * Options (env vars):
 *   BRAND_ID      — only process songs for this brand ID (optional)
 *   DELAY_MS      — ms between Groq requests, default 8000
 *   DRY_RUN=true  — print what would be processed without calling Groq or S3
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Groq from 'groq-sdk';
import { Sequelize, DataTypes, Op } from 'sequelize';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extractDSPFeatures, describeAudioFeatures } from '../src/utils/audioFeatures';

// ── Config ───────────────────────────────────────────────────────────────────

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const BRAND_ID = process.env.BRAND_ID ? parseInt(process.env.BRAND_ID, 10) : null;
const DELAY_MS = process.env.DELAY_MS ? parseInt(process.env.DELAY_MS, 10) : 8000;
const DRY_RUN = process.env.DRY_RUN === 'true';
const FORCE = process.env.FORCE === 'true';
const MAX_RETRIES = 4;
const LYRICS_SNIPPET_LENGTH = 800;
const BUCKET = process.env.S3_BUCKET_MASTERS || '';

// ── DB setup (standalone) ────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set in .env');
  process.exit(1);
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

const Song = sequelize.define(
  'Song',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    brand_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    tempo: { type: DataTypes.FLOAT, allowNull: true },
    duration: { type: DataTypes.INTEGER, allowNull: true },
    lyrics: { type: DataTypes.TEXT, allowNull: true },
    audio_file: { type: DataTypes.STRING(255), allowNull: true },
    audio_file_mp3: { type: DataTypes.STRING(255), allowNull: true },
    ai_summary: { type: DataTypes.TEXT, allowNull: true },
    audio_key: { type: DataTypes.STRING(10), allowNull: true },
    audio_scale: { type: DataTypes.STRING(10), allowNull: true },
    audio_key_strength: { type: DataTypes.FLOAT, allowNull: true },
    audio_energy: { type: DataTypes.FLOAT, allowNull: true },
    audio_danceability: { type: DataTypes.FLOAT, allowNull: true },
    audio_dynamic_complexity: { type: DataTypes.FLOAT, allowNull: true },
    audio_loudness: { type: DataTypes.FLOAT, allowNull: true },
    audio_mood: { type: DataTypes.JSONB, allowNull: true },
  },
  { tableName: 'song', timestamps: true }
);

// ── S3 ───────────────────────────────────────────────────────────────────────

const s3Config: ConstructorParameters<typeof S3Client>[0] = {
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
};
if (process.env.S3_ENDPOINT) {
  s3Config.endpoint = process.env.S3_ENDPOINT;
  s3Config.forcePathStyle = true;
}
const s3 = new S3Client(s3Config);

async function downloadS3Buffer(key: string): Promise<Buffer> {
  const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTime(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

async function generateSummary(groq: Groq, song: any): Promise<string> {
  const contextParts: string[] = [`Song title: "${song.title}"`];

  // Download audio and run Essentia feature extraction
  const audioKey = song.audio_file_mp3 || song.audio_file;
  if (audioKey && BUCKET) {
    try {
      console.log(`  → Downloading audio for Essentia analysis...`);
      const audioBuffer = await downloadS3Buffer(audioKey);
      const dspFeatures = await extractDSPFeatures(audioBuffer);
      // Save DSP features to DB
      const dspUpdate: any = {};
      if (dspFeatures.bpm && !song.tempo) { dspUpdate.tempo = dspFeatures.bpm; }
      if (dspFeatures.duration) dspUpdate.duration = dspFeatures.duration;
      if (dspFeatures.key) dspUpdate.audio_key = dspFeatures.key;
      if (dspFeatures.scale) dspUpdate.audio_scale = dspFeatures.scale;
      if (dspFeatures.keyStrength != null) dspUpdate.audio_key_strength = dspFeatures.keyStrength;
      if (dspFeatures.energy != null) dspUpdate.audio_energy = dspFeatures.energy;
      if (dspFeatures.danceability != null) dspUpdate.audio_danceability = dspFeatures.danceability;
      if (dspFeatures.dynamicComplexity != null) dspUpdate.audio_dynamic_complexity = dspFeatures.dynamicComplexity;
      if (dspFeatures.loudness != null) dspUpdate.audio_loudness = dspFeatures.loudness;
      if (Object.keys(dspUpdate).length > 0) await song.update(dspUpdate);

      // Run mood detection and save
      let features: import('../src/utils/audioFeatures').AudioFeatures = { ...dspFeatures };
      try {
        const { extractMoodScores } = require('../src/utils/audioFeatures');
        features.mood = await extractMoodScores(audioBuffer);
        await song.update({ audio_mood: features.mood });
      } catch (moodErr: any) {
        console.warn(`  ⚠ Mood detection skipped: ${moodErr?.message ?? moodErr}`);
      }

      const lines = describeAudioFeatures(features);
      if (lines.length > 0) {
        console.log(`  → Essentia features: ${lines.join(' | ')}`);
        contextParts.push(`Audio analysis:\n${lines.map((l: string) => `- ${l}`).join('\n')}`);
      } else {
        console.log(`  → Essentia returned no features.`);
      }
    } catch (err: any) {
      const reason = err?.Code === 'NoSuchKey' || err?.name === 'NoSuchKey'
        ? 'file not found in S3 (skipping audio analysis)'
        : err?.message ?? String(err);
      console.warn(`  ⚠ Audio analysis skipped: ${reason}`);
      if (song.tempo) contextParts.push(`Tempo: ${Math.round(song.tempo)} BPM`);
    }
  } else if (song.tempo) {
    contextParts.push(`Tempo: ${Math.round(song.tempo)} BPM`);
  }

  if (song.lyrics) {
    const snippet = song.lyrics.substring(0, LYRICS_SNIPPET_LENGTH);
    contextParts.push(`Lyrics excerpt:\n${snippet}${song.lyrics.length > LYRICS_SNIPPET_LENGTH ? '...' : ''}`);
  }

  const prompt = `You are a music supervisor assistant. Based on the following information about a song, write a concise 2–3 sentence description of its mood, themes, and musical character. Focus on what makes it suitable or distinctive for sync licensing (e.g. film, TV, advertising). Do not parrot back raw data like key names or BPM numbers — translate them into descriptive language about the feel and atmosphere.

${contextParts.join('\n\n')}

Write only the description, no preamble or labels.`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

async function generateWithRetry(groq: Groq, song: any): Promise<string | null> {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      return await generateSummary(groq, song);
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      if (status === 429) {
        const retryAfter = err?.headers?.['retry-after'];
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000 + 500
          : Math.min(2 ** attempt * 5000, 60000);
        console.log(`  ⏳ Rate limited. Waiting ${formatTime(waitMs)} before retry ${attempt + 1}/${MAX_RETRIES}...`);
        await sleep(waitMs);
        attempt++;
      } else {
        console.error(`  ✗ Groq error (status ${status ?? 'unknown'}):`, err?.message ?? err);
        return null;
      }
    }
  }
  console.error(`  ✗ Gave up after ${MAX_RETRIES} retries.`);
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Song AI Summary Populator ===');
  if (DRY_RUN) console.log('DRY RUN — no Groq/S3 calls or DB writes will be made.');
  if (FORCE) console.log('FORCE — existing summaries will be overwritten.');
  console.log();

  if (!GROQ_API_KEY && !DRY_RUN) {
    console.error('Error: GROQ_API_KEY is not set in .env');
    process.exit(1);
  }

  await sequelize.authenticate();
  console.log('Connected to database.\n');

  const whereClause: any = FORCE
    ? {}
    : { [Op.or]: [{ ai_summary: null }, { ai_summary: '' }] };
  if (BRAND_ID) {
    whereClause.brand_id = BRAND_ID;
    console.log(`Filtering to brand_id = ${BRAND_ID}`);
  }

  const songs = await Song.findAll({
    where: whereClause,
    attributes: ['id', 'brand_id', 'title', 'tempo', 'lyrics', 'audio_file', 'audio_file_mp3'],
    order: [['brand_id', 'ASC'], ['id', 'ASC']],
  });

  if (songs.length === 0) {
    console.log('All songs already have AI summaries. Nothing to do.');
    await sequelize.close();
    return;
  }

  const estimatedTime = songs.length * DELAY_MS;
  console.log(`Found ${songs.length} song(s) without AI summary.`);
  console.log(`Delay between Groq requests: ${DELAY_MS}ms`);
  console.log(`Estimated time: ~${formatTime(estimatedTime)}\n`);

  if (DRY_RUN) {
    for (const song of songs) {
      const s = song as any;
      const hasAudio = s.audio_file_mp3 ? 'mp3' : s.audio_file ? 'wav' : 'no audio';
      const hasLyrics = s.lyrics ? `${s.lyrics.length} chars` : 'no lyrics';
      const hasTempo = s.tempo ? `${s.tempo} BPM` : 'no tempo';
      console.log(`  [${s.id}] brand=${s.brand_id} — "${s.title}" (${hasAudio}, ${hasTempo}, ${hasLyrics})`);
    }
    await sequelize.close();
    return;
  }

  const groq = new Groq({ apiKey: GROQ_API_KEY });
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i] as any;
    const progress = `[${i + 1}/${songs.length}]`;

    if (!song.title?.trim()) {
      console.log(`${progress} Skipping song ${song.id} — no title.`);
      skipped++;
      continue;
    }

    const hasAudio = song.audio_file_mp3 || song.audio_file ? '🎵 audio' : '📄 metadata only';
    console.log(`${progress} Processing "${song.title}" (id=${song.id}, brand=${song.brand_id}, ${hasAudio})...`);

    const summary = await generateWithRetry(groq, song);

    if (!summary) {
      console.log(`  ✗ Failed — skipping.`);
      failed++;
    } else {
      await song.update({ ai_summary: summary });
      console.log(`  ✓ "${summary.substring(0, 80)}${summary.length > 80 ? '...' : ''}"`);
      succeeded++;
    }

    if (i < songs.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log('\n=== Done ===');
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Skipped:   ${skipped}`);

  await sequelize.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
