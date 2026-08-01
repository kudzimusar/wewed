import { deflateRawSync, inflateRawSync } from 'node:zlib'

interface ZipEntry { name: string; data: Buffer }
const U32 = (buffer: Buffer, offset: number) => buffer.readUInt32LE(offset)
const U16 = (buffer: Buffer, offset: number) => buffer.readUInt16LE(offset)

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()
function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

export function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  let eocd = -1
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65_557); index--) {
    if (U32(buffer, index) === 0x06054b50) { eocd = index; break }
  }
  if (eocd < 0) throw new Error('Invalid XLSX archive: end directory not found.')
  const count = U16(buffer, eocd + 10)
  let cursor = U32(buffer, eocd + 16)
  const entries = new Map<string, Buffer>()
  for (let index = 0; index < count; index++) {
    if (U32(buffer, cursor) !== 0x02014b50) throw new Error('Invalid XLSX archive: central directory entry missing.')
    const method = U16(buffer, cursor + 10)
    const compressedSize = U32(buffer, cursor + 20)
    const fileNameLength = U16(buffer, cursor + 28)
    const extraLength = U16(buffer, cursor + 30)
    const commentLength = U16(buffer, cursor + 32)
    const localOffset = U32(buffer, cursor + 42)
    const name = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf8')
    if (U32(buffer, localOffset) !== 0x04034b50) throw new Error(`Invalid local entry for ${name}.`)
    const localNameLength = U16(buffer, localOffset + 26)
    const localExtraLength = U16(buffer, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize)
    const data = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : (() => { throw new Error(`Unsupported ZIP method ${method}.`) })()
    entries.set(name, data)
    cursor += 46 + fileNameLength + extraLength + commentLength
  }
  return entries
}

export function writeZipEntries(entries: Map<string, Buffer>): Buffer {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const [name, data] of entries) {
    const nameBuffer = Buffer.from(name)
    const compressed = deflateRawSync(data)
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuffer.length, 26)
    locals.push(local, nameBuffer, compressed)

    const directory = Buffer.alloc(46)
    directory.writeUInt32LE(0x02014b50, 0)
    directory.writeUInt16LE(20, 4)
    directory.writeUInt16LE(20, 6)
    directory.writeUInt16LE(0, 8)
    directory.writeUInt16LE(8, 10)
    directory.writeUInt32LE(crc, 16)
    directory.writeUInt32LE(compressed.length, 20)
    directory.writeUInt32LE(data.length, 24)
    directory.writeUInt16LE(nameBuffer.length, 28)
    directory.writeUInt32LE(offset, 42)
    central.push(directory, nameBuffer)
    offset += local.length + nameBuffer.length + compressed.length
  }
  const centralSize = central.reduce((total, part) => total + part.length, 0)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.size, 8)
  eocd.writeUInt16LE(entries.size, 10)
  eocd.writeUInt32LE(centralSize, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...central, eocd])
}

export function patchXlsx(buffer: Buffer, patches: Record<string, string | Buffer>): Buffer {
  const entries = readZipEntries(buffer)
  for (const [name, value] of Object.entries(patches)) entries.set(name, Buffer.isBuffer(value) ? value : Buffer.from(value))
  return writeZipEntries(entries)
}
