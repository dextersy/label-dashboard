import { Readable } from 'stream';

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// Lower sample rate for BPM detection — reduces memory by ~4x vs 44100
const ANALYSIS_SAMPLE_RATE = 11025;

interface AudioAnalysis {
  bpm: number | null;
  duration: number | null;
}

/**
 * Analyze an audio buffer to detect BPM and duration.
 * Uses ffprobe for duration (no decode needed) and a downsampled
 * PCM stream for BPM detection to avoid heap issues with large files.
 */
export async function analyzeAudio(wavBuffer: Buffer): Promise<AudioAnalysis> {
  let duration: number | null = null;
  let bpm: number | null = null;

  // Get duration via ffprobe — no PCM decode needed
  try {
    duration = await probeDuration(wavBuffer);
  } catch (err) {
    console.error('Duration detection failed:', err);
  }

  // Get BPM via downsampled PCM
  try {
    const pcmData = await decodeToFloat32PCM(wavBuffer);
    const MusicTempo = require('music-tempo');
    const mt = new MusicTempo(pcmData);
    const detectedBpm = Math.round(mt.tempo);
    if (detectedBpm > 0) {
      bpm = detectedBpm;
    }
  } catch (err) {
    console.error('BPM detection failed:', err);
  }

  return { bpm, duration };
}

/**
 * Use ffprobe to get the duration in seconds without decoding audio.
 */
function probeDuration(wavBuffer: Buffer): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const inputStream = Readable.from(wavBuffer);
    const command = ffmpeg(inputStream).inputFormat('wav');

    command.ffprobe((err: Error | null, data: any) => {
      if (err) return reject(err);
      const seconds = data?.format?.duration;
      if (seconds && seconds > 0) {
        resolve(Math.round(seconds));
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Decode an audio buffer to mono float32 PCM at a low sample rate.
 * Uses 11025 Hz to keep memory usage manageable for BPM analysis.
 */
function decodeToFloat32PCM(wavBuffer: Buffer): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const inputStream = Readable.from(wavBuffer);
    const chunks: Buffer[] = [];

    const command = ffmpeg(inputStream)
      .inputFormat('wav')
      .audioChannels(1)
      .audioFrequency(ANALYSIS_SAMPLE_RATE)
      .format('f32le')
      .audioCodec('pcm_f32le')
      .on('error', (err: Error) => reject(err));

    const outputStream = command.pipe();
    outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    outputStream.on('end', () => {
      const rawBuffer = Buffer.concat(chunks);
      // Copy into a properly-sized Float32Array (don't share the concat buffer)
      const sampleCount = rawBuffer.length / 4;
      const float32Array = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        float32Array[i] = rawBuffer.readFloatLE(i * 4);
      }
      resolve(float32Array);
    });
    outputStream.on('error', (err: Error) => reject(err));
  });
}
