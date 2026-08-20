import { describe, expect, test } from 'bun:test'
import { encodeMonoPcm16Wav, notebookLiveChunkSampleLimit } from './browser-audio'

describe('Notebook browser audio preparation', () => {
  test('encodes microphone PCM as mono 16-bit WAV for bounded private transcription chunks', async () => {
    const wav = encodeMonoPcm16Wav([
      new Float32Array([0, 0.5, -0.5, 1, -1]),
      new Float32Array([0.25, -0.25]),
    ], 16_000)

    expect(wav.type).toBe('audio/wav')
    expect(wav.size).toBe(44 + (7 * 2))

    const bytes = new Uint8Array(await wav.arrayBuffer())
    const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length))
    expect(ascii(0, 4)).toBe('RIFF')
    expect(ascii(8, 4)).toBe('WAVE')
    expect(ascii(12, 4)).toBe('fmt ')
    expect(ascii(36, 4)).toBe('data')
  })

  test('uses 20-second chunks and caps any requested chunk at 25 seconds', () => {
    expect(notebookLiveChunkSampleLimit(16_000, 20)).toBe(320_000)
    expect(notebookLiveChunkSampleLimit(48_000, 30)).toBe(1_200_000)
    expect(notebookLiveChunkSampleLimit(16_000, 2)).toBe(80_000)
  })
})
