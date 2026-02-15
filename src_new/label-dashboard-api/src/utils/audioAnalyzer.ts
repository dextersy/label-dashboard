import { Readable } from 'stream';

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

// Lower sample rate keeps memory manageable for BPM analysis
const ANALYSIS_SAMPLE_RATE = 11025;

// Only buffer 60 seconds of audio for BPM detection — music-tempo
// doesn't need the full track and this caps memory usage
const BPM_SAMPLE_LIMIT = ANALYSIS_SAMPLE_RATE * 60; // 60s worth of samples

interface AudioAnalysis {
  bpm: number | null;
  duration: number | null;
}

/**
 * Analyze an audio buffer to detect BPM and duration.
 *
 * Duration is computed by streaming PCM and counting total bytes
 * without buffering the entire output.
 *
 * BPM is detected from the first 60 seconds only, capping memory usage
 * to ~240 KB regardless of track length.
 */
export async function analyzeAudio(wavBuffer: Buffer): Promise<AudioAnalysis> {
  let duration: number | null = null;
  let bpm: number | null = null;

  try {
    const { totalSamples, bpmSamples } = await decodePCM(wavBuffer);

    // Duration from total sample count (streamed, not buffered)
    const totalSeconds = Math.round(totalSamples / ANALYSIS_SAMPLE_RATE);
    if (totalSeconds > 0) {
      duration = totalSeconds;
    }

    // BPM from the first 60s
    if (bpmSamples.length > 0) {
      try {
        const MusicTempo = require('music-tempo');
        const mt = new MusicTempo(bpmSamples);
        const detectedBpm = Math.round(mt.tempo);
        if (detectedBpm > 0) {
          bpm = detectedBpm;
        }
      } catch (bpmError) {
        console.error('BPM detection failed:', bpmError);
      }
    }
  } catch (err) {
    console.error('Audio analysis failed:', err);
  }

  return { bpm, duration };
}

interface DecodedPCM {
  totalSamples: number;
  bpmSamples: Float32Array;
}

/**
 * Decode audio to mono float32 PCM at a low sample rate.
 * Streams the full output to count total samples for duration,
 * but only buffers the first 60 seconds for BPM analysis.
 */
function decodePCM(wavBuffer: Buffer): Promise<DecodedPCM> {
  return new Promise((resolve, reject) => {
    const inputStream = Readable.from(wavBuffer);
    const bpmChunks: Buffer[] = [];
    let bpmSamplesCollected = 0;
    let totalBytes = 0;

    const command = ffmpeg(inputStream)
      .inputFormat('wav')
      .audioChannels(1)
      .audioFrequency(ANALYSIS_SAMPLE_RATE)
      .format('f32le')
      .audioCodec('pcm_f32le')
      .on('error', (err: Error) => reject(err));

    const outputStream = command.pipe();
    outputStream.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;

      // Only buffer chunks until we have 60s worth for BPM
      if (bpmSamplesCollected < BPM_SAMPLE_LIMIT) {
        const samplesInChunk = chunk.length / 4;
        const samplesNeeded = BPM_SAMPLE_LIMIT - bpmSamplesCollected;

        if (samplesInChunk <= samplesNeeded) {
          bpmChunks.push(chunk);
          bpmSamplesCollected += samplesInChunk;
        } else {
          // Only take what we need from this chunk
          bpmChunks.push(chunk.subarray(0, samplesNeeded * 4));
          bpmSamplesCollected += samplesNeeded;
        }
      }
      // Remaining chunks are counted but not buffered
    });
    outputStream.on('end', () => {
      const totalSamples = totalBytes / 4;

      // Build Float32Array from buffered BPM chunks
      const rawBuffer = Buffer.concat(bpmChunks);
      const sampleCount = rawBuffer.length / 4;
      const bpmSamples = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        bpmSamples[i] = rawBuffer.readFloatLE(i * 4);
      }

      resolve({ totalSamples, bpmSamples });
    });
    outputStream.on('error', (err: Error) => reject(err));
  });
}
