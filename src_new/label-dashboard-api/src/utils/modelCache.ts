/**
 * Disk cache for Essentia TF.js model files.
 *
 * Essentia hosts models as TF1 frozen graphs (.pb). This module:
 *   1. Downloads the Essentia metadata JSON to discover the .pb URL.
 *   2. Downloads the .pb file.
 *   3. Converts it to TF.js GraphModel format (model.json + .bin shard)
 *      using convertFrozenGraph() — no Python required.
 *   4. Serves the converted files via a local HTTP server on 127.0.0.1:27182.
 *
 * Subsequent process startups skip download+conversion and serve from disk.
 * Total footprint: ~26 MB for 7 mood classifiers.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { convertFrozenGraph } from './convertEssentiaModel';

const CACHE_DIR = path.join(__dirname, '../../model-cache');
const CONVERTED_DIR = path.join(CACHE_DIR, 'converted');
const SERVER_PORT = 27182;

let server: http.Server | null = null;
let serverStarted = false;

// ── Local file server ─────────────────────────────────────────────────────────

function ensureServer(): Promise<void> {
  if (serverStarted) return Promise.resolve();

  fs.mkdirSync(CONVERTED_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      // Safety: prevent path traversal
      const urlPath = (req.url || '/').replace(/\.\./g, '');
      const filePath = path.join(CONVERTED_DIR, urlPath);

      if (!filePath.startsWith(CONVERTED_DIR) || !fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end();
        return;
      }

      const contentType = filePath.endsWith('.json')
        ? 'application/json'
        : 'application/octet-stream';

      try {
        const data = fs.readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': data.length,
          'Connection': 'close',
        });
        res.end(data);
      } catch (err) {
        console.error('[modelCache] File read error:', err);
        res.writeHead(500);
        res.end();
      }
    });

    server.listen(SERVER_PORT, '127.0.0.1', () => {
      serverStarted = true;
      console.log(`[modelCache] Model server started on port ${SERVER_PORT}.`);
      resolve();
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[modelCache] Port ${SERVER_PORT} already in use — reusing existing server. NOTE: if the existing server is stale, kill it and restart.`);
        serverStarted = true;
        resolve();
      } else {
        reject(err);
      }
    });
  });
}

// ── Download helpers ──────────────────────────────────────────────────────────

async function downloadBinary(url: string, destPath: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[modelCache] Failed to download ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return buf;
}

/**
 * Given an Essentia metadata JSON URL (e.g. mood_happy-musicnn-msd-2.json),
 * downloads the referenced .pb file and converts it to TF.js GraphModel format.
 * Returns the local directory path of the converted model.json.
 */
async function downloadAndConvertModel(essentiaMetaUrl: string): Promise<string> {
  // Derive a stable directory name from the metadata URL
  const metaName = path.basename(essentiaMetaUrl, '.json'); // e.g. "mood_happy-musicnn-msd-2"
  const outDir = path.join(CONVERTED_DIR, metaName);
  const modelJsonPath = path.join(outDir, 'model.json');

  if (fs.existsSync(modelJsonPath)) return outDir; // already converted

  console.log(`[modelCache] Fetching Essentia metadata: ${path.basename(essentiaMetaUrl)}`);
  const metaRes = await fetch(essentiaMetaUrl);
  if (!metaRes.ok) throw new Error(`[modelCache] Failed to fetch ${essentiaMetaUrl}: HTTP ${metaRes.status}`);
  const meta = (await metaRes.json()) as any;

  // Essentia metadata has a "link" field pointing to the .pb file
  const pbUrl: string = meta.link;
  if (!pbUrl || !pbUrl.endsWith('.pb')) {
    throw new Error(`[modelCache] No .pb link found in Essentia metadata for ${metaName}`);
  }

  console.log(`[modelCache] Downloading model: ${path.basename(pbUrl)} (~${Math.round(3.2)}MB)...`);
  const pbCachePath = path.join(CACHE_DIR, path.basename(pbUrl));
  let pbBuffer: Buffer;
  if (fs.existsSync(pbCachePath)) {
    pbBuffer = fs.readFileSync(pbCachePath);
  } else {
    pbBuffer = await downloadBinary(pbUrl, pbCachePath);
  }

  console.log(`[modelCache] Converting ${metaName} to TF.js format...`);
  await convertFrozenGraph(pbBuffer, outDir);
  console.log(`[modelCache] Converted ${metaName}`);

  return outDir;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a local HTTP URL for the given Essentia metadata JSON URL.
 * On first call, downloads the .pb and converts to TF.js format.
 * Subsequent calls return immediately from disk cache.
 */
export async function getCachedModelUrl(essentiaMetaUrl: string): Promise<string> {
  await ensureServer();
  const metaName = path.basename(essentiaMetaUrl, '.json');
  await downloadAndConvertModel(essentiaMetaUrl);
  return `http://127.0.0.1:${SERVER_PORT}/${metaName}/model.json`;
}

/**
 * Pre-warm: convert all provided Essentia metadata URLs in parallel.
 * Call at application startup to avoid first-request latency.
 */
export async function prewarmModels(essentiaMetaUrls: string[]): Promise<void> {
  await ensureServer();
  await Promise.all(essentiaMetaUrls.map(url => downloadAndConvertModel(url)));
}
