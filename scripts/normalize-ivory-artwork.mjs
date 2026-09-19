import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root = 'public/invitation-art/ivory/'
// Pixel crops remove only the presentation device. All scaling is uniform.
const crops = {
  closed: [183, 144, 648, 1292],
  open: [54, 108, 814, 1530],
  details: [48, 92, 758, 1705],
  opening: [20, 355, 1030, 1695],
}
const manifest = { canvas: [1080, 2340], sources: {}, normalized: {} }
for (const [state, [left, top, width, height]] of Object.entries(crops)) {
  const input = await readFile(root + 'reference/' + state + '.png')
  const crop = await sharp(input).extract({ left, top, width, height }).png().toBuffer()
  const scale = Math.min(1080 / width, 2340 / height)
  const w = Math.round(width * scale),
    h = Math.round(height * scale)
  const x = Math.floor((1080 - w) / 2),
    y = Math.floor((2340 - h) / 2)
  const paper = await sharp({
    create: { width: 1080, height: 2340, channels: 3, background: '#f3e7d5' },
  })
    .png()
    .toBuffer()
  const normalized = await sharp(paper)
    .composite([
      {
        input: await sharp(crop).resize(w, h).png().toBuffer(),
        left: x,
        top: y,
      },
    ])
    .png()
    .toBuffer()
  await sharp(normalized)
    .webp({ quality: 95 })
    .toFile(root + state + '-master.webp')
  manifest.sources[state] = {
    sha256: createHash('sha256').update(input).digest('hex'),
    crop: [left, top, width, height],
    provenance:
      state === 'opening'
        ? 'Embedded raster extracted from charity_kudzie_opening_view_mobile.pdf'
        : 'Original approved session PNG',
  }
  manifest.normalized[state] = { x, y, width: w, height: h }
}
await writeFile(root + 'manifest.json', JSON.stringify(manifest, null, 2) + '\n')
// Text replacement patches use only sampled paper pixels. Botanical borders and
// ornaments outside these explicit ink bounds are never synthesized or retraced.
async function erase(state, boxes) {
  const { data, info } = await sharp(root + state + '-master.webp')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info,
    mask = new Uint8Array(W * H)
  // Identify ink within known text bounds, then repair only those pixels using
  // nearby original paper. No rectangular replacement of the material surface.
  for (const [x, y, w, h] of boxes)
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        const p = j * W + i,
          k = p * 3,
          r = data[k],
          g = data[k + 1],
          b = data[k + 2]
        if (g < 172 || r - b > 74)
          for (let dy = -3; dy <= 3; dy++)
            for (let dx = -3; dx <= 3; dx++) {
              const xx = i + dx,
                yy = j + dy
              if (xx >= x && xx < x + w && yy >= y && yy < y + h) mask[yy * W + xx] = 1
            }
      }
  const pending = []
  for (let p = 0; p < mask.length; p++) if (mask[p]) pending.push(p)
  let remaining = pending
  while (remaining.length) {
    const next = [],
      updates = []
    for (const p of remaining) {
      let n = 0,
        r = 0,
        g = 0,
        b = 0
      for (const d of [-W, -1, 1, W]) {
        const q = p + d
        if (q >= 0 && q < W * H && !mask[q]) {
          n++
          r += data[q * 3]
          g += data[q * 3 + 1]
          b += data[q * 3 + 2]
        }
      }
      if (n) updates.push([p, r / n, g / n, b / n])
      else next.push(p)
    }
    if (!updates.length) break
    for (const [p, r, g, b] of updates) {
      data[p * 3] = r
      data[p * 3 + 1] = g
      data[p * 3 + 2] = b
      mask[p] = 0
    }
    remaining = next
  }
  await sharp(data, { raw: info })
    .webp({ quality: 95 })
    .toFile(root + state + '-surface.webp')
}
await erase('closed', [
  [420, 920, 100, 130],
  [570, 920, 100, 130],
])
await erase('open', [
  [305, 460, 476, 485],
  [251, 1323, 580, 207],
  [270, 1591, 550, 189],
  [310, 1854, 457, 175],
  [270, 1000, 560, 267],
])
await erase('details', [
  [295, 53, 550, 63],
  [320, 1314, 540, 124],
  [325, 1778, 530, 94],
  [300, 605, 530, 125],
])
for (const side of ['left', 'right']) {
  await sharp(root + 'closed-surface.webp')
    .extract({
      left: side === 'left' ? 0 : 540,
      top: 0,
      width: 540,
      height: 2340,
    })
    .webp({ quality: 95 })
    .toFile(root + side + '-door.webp')
}

await sharp(root + 'reference/open.png')
  .extract({ left: 280, top: 190, width: 100, height: 40 })
  .resize(900, 200)
  .webp({ quality: 95 })
  .toFile(root + 'paper.webp')
