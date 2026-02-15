import { Readable } from 'stream';

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

const SAMPLE_RATE = 44100;

interface AudioAnalysis {
  bpm: number | null;
  duration: number | null;
}

/**
 * Analyze a WAV audio buffer to detect BPM and duration.
 * Decodes to PCM once, then extracts both values.
 * Returns { bpm, duration } — either may be null on failure.
 */
export async function analyzeAudio(wavBuffer: Buffer): Promise<AudioAnalysis> {
  try {
    const pcmData = await decodeToFloat32PCM(wavBuffer);

    // Duration from sample count
    let duration: number | null = null;
    const totalSeconds = Math.round(pcmData.length / SAMPLE_RATE);
    if (totalSeconds > 0) {
      duration = totalSeconds;
    }

    // BPM via music-tempo
    let bpm: number | null = null;
    try {
      const MusicTempo = require('music-tempo');
      const mt = new MusicTempo(pcmData);
      const detectedBpm = Math.round(mt.tempo);
      if (detectedBpm > 0) {
        bpm = detectedBpm;
      }
    } catch (bpmError) {
      console.error('BPM detection failed:', bpmError);
    }

    return { bpm, duration };
  } catch (error) {
    console.error('Audio analysis failed:', error);
    return { bpm: null, duration: null };
  }
}

/**
 * Decode a WAV buffer to mono float32 PCM data using ffmpeg.
 * Returns a Float32Array suitable for music-tempo analysis.
 */
function decodeToFloat32PCM(wavBuffer: Buffer): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const inputStream = Readable.from(wavBuffer);
    const chunks: Buffer[] = [];

    const command = ffmpeg(inputStream)
      .inputFormat('wav')
      .audioChannels(1)
      .audioFrequency(SAMPLE_RATE)
      .format('f32le')
      .audioCodec('pcm_f32le')
      .on('error', (err: Error) => reject(err));

    const outputStream = command.pipe();
    outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    outputStream.on('end', () => {
      const rawBuffer = Buffer.concat(chunks);
      const float32Array = new Float32Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.length / 4);
      resolve(float32Array);
    });
    outputStream.on('error', (err: Error) => reject(err));
  });
}
