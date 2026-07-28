import { Readable } from 'stream';
import { getCachedModelUrl, prewarmModels } from './modelCache';

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface MoodScores {
  happy?: number;
  sad?: number;
  aggressive?: number;
  relaxed?: number;
  party?: number;
  acoustic?: number;
  electronic?: number;
}

export interface AudioFeatures {
  key?: string;
  scale?: string;
  keyStrength?: number;
  bpm?: number;
  duration?: number; // seconds
  energy?: number;
  danceability?: number;
  dynamicComplexity?: number;
  loudness?: number;
  mood?: MoodScores;
}

// ── Model URLs (Essentia public model repository) ─────────────────────────────

const MOOD_MODEL_URLS: Record<keyof MoodScores, string> = {
  happy:      'https://essentia.upf.edu/models/classifiers/mood_happy/mood_happy-musicnn-msd-2.json',
  sad:        'https://essentia.upf.edu/models/classifiers/mood_sad/mood_sad-musicnn-msd-2.json',
  aggressive: 'https://essentia.upf.edu/models/classifiers/mood_aggressive/mood_aggressive-musicnn-msd-2.json',
  relaxed:    'https://essentia.upf.edu/models/classifiers/mood_relaxed/mood_relaxed-musicnn-msd-2.json',
  party:      'https://essentia.upf.edu/models/classifiers/mood_party/mood_party-musicnn-msd-2.json',
  acoustic:   'https://essentia.upf.edu/models/classifiers/mood_acoustic/mood_acoustic-musicnn-msd-2.json',
  electronic: 'https://essentia.upf.edu/models/classifiers/mood_electronic/mood_electronic-musicnn-msd-2.json',
};

// ── Singletons ────────────────────────────────────────────────────────────────

let essentiaInstance: any = null;
let essentiaWasmModule: any = null; // raw WASM module (for EssentiaTFInputExtractor)
const moodModelCache = new Map<string, any>();

async function getEssentia(): Promise<{ essentia: any; wasmModule: any }> {
  if (essentiaInstance) return { essentia: essentiaInstance, wasmModule: essentiaWasmModule };
  const { EssentiaWASM, Essentia } = require('essentia.js');
  essentiaWasmModule = EssentiaWASM;
  essentiaInstance = new Essentia(EssentiaWASM);
  return { essentia: essentiaInstance, wasmModule: essentiaWasmModule };
}

async function getMoodModel(tf: any, mood: string): Promise<any> {
  if (moodModelCache.has(mood)) return moodModelCache.get(mood);
  const localUrl = await getCachedModelUrl(MOOD_MODEL_URLS[mood as keyof MoodScores]);
  const model = await tf.loadGraphModel(localUrl);
  moodModelCache.set(mood, model);
  return model;
}

/**
 * Download and convert all mood models to TF.js format in parallel.
 * Call at server startup to avoid first-request latency on first mood request.
 */
export async function prewarmAudioModels(): Promise<void> {
  await prewarmModels(Object.values(MOOD_MODEL_URLS));
  console.log('[audioFeatures] Mood models ready.');
}

// ── Audio conversion ──────────────────────────────────────────────────────────

/**
 * Convert any ffmpeg-readable audio buffer to mono float32 PCM at the given sample rate.
 * Caps at maxSeconds to keep memory usage bounded.
 */
function toPCM(audioBuffer: Buffer, maxSeconds = 60, sampleRate = 44100): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const inputStream = Readable.from(audioBuffer);
    const chunks: Buffer[] = [];

    const command = ffmpeg(inputStream)
      .outputOptions(['-f f32le', '-ac 1', `-ar ${sampleRate}`, `-t ${maxSeconds}`])
      .on('error', reject);

    const output = command.pipe();
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    output.on('end', () => {
      const combined = Buffer.concat(chunks);
      resolve(new Float32Array(combined.buffer, combined.byteOffset, combined.byteLength / 4));
    });
    output.on('error', reject);
  });
}

// ── DSP feature extraction (Essentia algorithms) ──────────────────────────────

/**
 * Extract musical features from an audio buffer using Essentia.js DSP algorithms.
 * All algorithms fail gracefully — partial results are still returned.
 */
export async function extractDSPFeatures(audioBuffer: Buffer): Promise<Omit<AudioFeatures, 'mood'>> {
  const { essentia } = await getEssentia();
  const sampleRate = 44100;
  const pcm = await toPCM(audioBuffer, 300, sampleRate);
  const features: Omit<AudioFeatures, 'mood'> = {};

  // Duration from PCM length
  features.duration = Math.round(pcm.length / sampleRate);

  const vec = essentia.arrayToVector(pcm);

  try {
    const bpmResult = essentia.PercivalBpmEstimator(vec);
    features.bpm = Math.round(bpmResult.bpm);
  } catch (e) {
    console.error('[audioFeatures] PercivalBpmEstimator failed:', e);
  }

  try {
    const r = essentia.KeyExtractor(vec);
    features.key = r.key;
    features.scale = r.scale;
    features.keyStrength = r.strength;
  } catch (e) {
    console.error('[audioFeatures] KeyExtractor failed:', e);
  }

  try {
    features.energy = essentia.Energy(vec).energy;
  } catch (e) {
    console.error('[audioFeatures] Energy failed:', e);
  }

  try {
    features.danceability = essentia.Danceability(vec).danceability;
  } catch (e) {
    console.error('[audioFeatures] Danceability failed:', e);
  }

  try {
    const r = essentia.DynamicComplexity(vec);
    features.dynamicComplexity = r.dynamicComplexity;
    features.loudness = r.loudness;
  } catch (e) {
    console.error('[audioFeatures] DynamicComplexity failed:', e);
  }

  vec.delete();
  return features;
}

// ── Mood detection (MusiCNN + classifier models) ──────────────────────────────

/**
 * Run the MusiCNN mood detection pipeline on an audio buffer.
 * Requires @tensorflow/tfjs and network access to fetch Essentia's hosted models
 * (models are cached in memory after first load).
 *
 * Pipeline:
 *   1. Convert audio to 16kHz PCM (MusiCNN input requirement)
 *   2. Extract mel-spectrogram patches using EssentiaTFInputExtractor
 *      (frame-by-frame to avoid broken FrameGenerator in essentia.js 0.1.3)
 *   3. Mean-pool patches → [1, 187, 96] representative patch
 *   4. Run each self-contained mood classifier directly on the mel patch
 *      (each classifier embeds MusiCNN internally; no separate MusiCNN step needed)
 *   5. Return binary classifier output → probability 0-1 per mood
 */
export async function extractMoodScores(audioBuffer: Buffer): Promise<MoodScores> {
  const tf = require('@tensorflow/tfjs');
  const { EssentiaModel } = require('essentia.js');
  const { wasmModule } = await getEssentia();

  // MusiCNN requires 16kHz mono input
  const pcm16k = await toPCM(audioBuffer, 60, 16000);

  // Extract mel-spectrogram patches frame by frame.
  // computeFrameWise() is broken in essentia.js 0.1.3 on Node.js (FrameGenerator crash).
  // extractor.compute() on individual frames works correctly.
  const extractor = new EssentiaModel.EssentiaTFInputExtractor(wasmModule, 'musicnn');
  const frameSize: number = extractor.frameSize;          // 512 for MusiCNN
  const hopSize: number = Math.floor(frameSize / 2);      // 50% overlap — matches training distribution
  const melSpectra: number[][] = [];
  let lastResult: any = null;
  for (let start = 0; start + frameSize <= pcm16k.length; start += hopSize) {
    const frame = pcm16k.subarray(start, start + frameSize);
    lastResult = extractor.compute(frame);
    melSpectra.push(lastResult.melSpectrum);
  }
  extractor.delete();

  if (melSpectra.length === 0) {
    throw new Error('No audio frames extracted — audio too short for MusiCNN');
  }

  // Each mood classifier expects input shape [1, 187, 96].
  // Group mel frames into non-overlapping patchSize-sized windows.
  const patchSize: number = lastResult.patchSize;   // 187 mel frames per patch
  const melBands: number = lastResult.melBandsSize; // 96 mel bands

  // Collect all non-overlapping patches, then evenly sample up to MAX_PATCHES of them.
  // This bounds inference cost regardless of song length (140+ calls otherwise).
  const MAX_PATCHES = 5;
  const allPatches: number[][][] = [];
  for (let i = 0; i + patchSize <= melSpectra.length; i += patchSize) {
    allPatches.push(melSpectra.slice(i, i + patchSize));
  }
  const patches: number[][][] = allPatches.length <= MAX_PATCHES
    ? allPatches
    : Array.from({ length: MAX_PATCHES }, (_, i) =>
        allPatches[Math.round(i * (allPatches.length - 1) / (MAX_PATCHES - 1))]);
  if (patches.length === 0) {
    // Audio too short for a full patch — zero-pad
    const padded = [...melSpectra];
    while (padded.length < patchSize) padded.push(new Array(melBands).fill(0));
    patches.push(padded.slice(0, patchSize));
  }

  // Run each mood classifier on every patch independently, then average the
  // output probabilities. This preserves temporal information lost by input mean-pooling.
  const scores: MoodScores = {};
  for (const mood of Object.keys(MOOD_MODEL_URLS) as (keyof MoodScores)[]) {
    try {
      const model = await getMoodModel(tf, mood);
      let sum = 0;
      let count = 0;
      for (const patch of patches) {
        const inputTensor = tf.tensor3d([patch]); // [1, 187, 96]
        // Specify 'model/Sigmoid' output node explicitly to get a single tensor back
        const outTensor: any = model.execute(
          { 'model/Placeholder': inputTensor },
          'model/Sigmoid',
        );
        const values = await outTensor.array() as number[][];
        // Binary classifier output shape [1, 2]: [non_mood, mood] — take positive class
        const prob = Array.isArray(values[0]) ? values[0][values[0].length - 1] : (values as any)[values.length - 1];
        sum += prob;
        count++;
        inputTensor.dispose();
        outTensor.dispose();
      }
      scores[mood] = count > 0 ? sum / count : 0;
      console.log(`[audioFeatures] Mood "${mood}": ${scores[mood]?.toFixed(3)} (${count} patches)`);
    } catch (e) {
      console.error(`[audioFeatures] Mood "${mood}" prediction failed:`, e);
    }
  }
  return scores;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract all audio features from a buffer: DSP features (key, energy, danceability,
 * dynamics) plus MusiCNN-based mood scores (happy, sad, aggressive, relaxed, etc.).
 */
export async function extractAudioFeatures(audioBuffer: Buffer): Promise<AudioFeatures> {
  const features: AudioFeatures = await extractDSPFeatures(audioBuffer);

  try {
    features.mood = await extractMoodScores(audioBuffer);
  } catch (e) {
    console.error('[audioFeatures] Mood detection failed:', e);
  }

  return features;
}

/**
 * Translate numeric audio features into human-readable phrases for the LLM prompt.
 */
export function describeAudioFeatures(features: AudioFeatures, tempo?: number | null): string[] {
  const lines: string[] = [];

  if (features.key && features.scale) {
    const confidence = features.keyStrength !== undefined
      ? ` (confidence: ${(features.keyStrength * 100).toFixed(0)}%)`
      : '';
    lines.push(`Key: ${features.key} ${features.scale}${confidence}`);
  }

  const bpm = features.bpm ?? (tempo ? Math.round(tempo) : undefined);
  if (bpm) {
    lines.push(`Tempo: ${bpm} BPM`);
  }

  if (features.energy !== undefined) {
    const label = features.energy > 0.7 ? 'high' : features.energy > 0.35 ? 'moderate' : 'low';
    lines.push(`Energy: ${label} (${features.energy.toFixed(2)})`);
  }

  if (features.danceability !== undefined) {
    const label = features.danceability > 1.5 ? 'highly danceable'
      : features.danceability > 0.8 ? 'moderately danceable'
      : 'not very danceable';
    lines.push(`Danceability: ${label} (${features.danceability.toFixed(2)})`);
  }

  if (features.dynamicComplexity !== undefined) {
    const label = features.dynamicComplexity > 0.7 ? 'wide dynamic range'
      : features.dynamicComplexity > 0.35 ? 'moderate dynamics'
      : 'compressed / consistent dynamics';
    lines.push(`Dynamics: ${label}`);
  }

  if (features.loudness !== undefined) {
    lines.push(`Loudness: ${features.loudness.toFixed(1)} dB`);
  }

  if (features.mood) {
    const dominant = (Object.entries(features.mood) as [keyof MoodScores, number | undefined][])
      .filter(([, score]) => score !== undefined && score > 0.5)
      .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
      .map(([mood, score]) => `${mood} (${(score! * 100).toFixed(0)}%)`);

    if (dominant.length > 0) {
      lines.push(`Mood: ${dominant.join(', ')}`);
    }
  }

  return lines;
}
