export function encodeMonoPcm16Wav(chunks: readonly Float32Array[], sampleRate: number): Blob {
  const normalizedRate = Number.isFinite(sampleRate) && sampleRate > 0 ? Math.round(sampleRate) : 16_000
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const dataBytes = sampleCount * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index))
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, normalizedRate, true)
  view.setUint32(28, normalizedRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(36, 'data')
  view.setUint32(40, dataBytes, true)

  let offset = 44
  for (const chunk of chunks) {
    for (let index = 0; index < chunk.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[index] ?? 0))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export function notebookLiveChunkSampleLimit(sampleRate: number, seconds = 20): number {
  const normalizedRate = Number.isFinite(sampleRate) && sampleRate > 0 ? Math.round(sampleRate) : 16_000
  const normalizedSeconds = Math.min(25, Math.max(5, Math.round(seconds)))
  return normalizedRate * normalizedSeconds
}
