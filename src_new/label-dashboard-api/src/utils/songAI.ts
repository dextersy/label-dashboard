import Groq from 'groq-sdk';
import { Song } from '../models';
import { describeAudioFeatures, AudioFeatures } from './audioFeatures';

async function _generateSongSummary(songId: number): Promise<void> {
  const song = await Song.findByPk(songId);
  if (!song) return;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('[songAI] GROQ_API_KEY not set — skipping summary generation.');
    return;
  }

  const contextParts: string[] = [`Song title: "${song.title}"`];

  // Build AudioFeatures from pre-computed DSP columns stored in DB
  const dspFeatures: AudioFeatures = {
    bpm: song.tempo ?? undefined,
    duration: song.duration ?? undefined,
    key: song.audio_key ?? undefined,
    scale: song.audio_scale ?? undefined,
    keyStrength: song.audio_key_strength ?? undefined,
    energy: song.audio_energy ?? undefined,
    danceability: song.audio_danceability ?? undefined,
    dynamicComplexity: song.audio_dynamic_complexity ?? undefined,
    loudness: song.audio_loudness ?? undefined,
    mood: song.audio_mood as AudioFeatures['mood'] ?? undefined,
  };

const lines = describeAudioFeatures(dspFeatures);
  if (lines.length > 0) {
    contextParts.push(`Audio analysis:\n${lines.map(l => `- ${l}`).join('\n')}`);
  }

  // Manually entered lyrics
  if (song.lyrics) {
    const snippet = song.lyrics.substring(0, 800);
    contextParts.push(`Lyrics excerpt:\n${snippet}${song.lyrics.length > 800 ? '...' : ''}`);
  }

  const prompt = `You are a music supervisor assistant. Based on the following information about a song, write a concise 2–3 sentence description of its mood, themes, and musical character. Focus on what makes it suitable or distinctive for sync licensing (e.g. film, TV, advertising). Do not parrot back raw data like key names or BPM numbers — translate them into descriptive language about the feel and atmosphere.

${contextParts.join('\n\n')}

Write only the description, no preamble or labels.`;

  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
  });

  const summary = completion.choices[0]?.message?.content?.trim() || '';
  if (summary) {
    await song.update({ ai_summary: summary });
    console.log(`[songAI] Summary generated for song ${songId}: "${summary.substring(0, 80)}..."`);
  }
}

/**
 * Fire-and-forget: generates an AI summary for a song in the background.
 * Safe to call immediately after saving — does not block the HTTP response.
 */
export function generateSongSummaryBackground(songId: number): void {
  _generateSongSummary(songId).catch(err => {
    console.error(`[songAI] Background summary failed for song ${songId}:`, err);
  });
}
