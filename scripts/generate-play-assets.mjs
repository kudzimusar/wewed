import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const sourceLogo = path.join(root, 'store-assets/source/wewed-logo-wordmark.png')
const hero = path.join(root, 'public/hero-wedding.png')
const playSourceDir = path.resolve(root, '../play-assets')
const playOutputDir = path.join(root, 'store-assets/google-play')
const uploadOutputDir = path.join(playSourceDir, 'upload')

const IVORY = '#FBF6EE'
const ESPRESSO = '#211712'
const GOLD = '#BF9B5F'

async function transparentLogo(extract) {
  const { data, info } = await sharp(sourceLogo)
    .extract(extract)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset]
    const green = data[offset + 1]
    const blue = data[offset + 2]
    const minimum = Math.min(red, green, blue)
    const maximum = Math.max(red, green, blue)

    if (minimum >= 246) {
      data[offset + 3] = 0
    } else if (minimum >= 225 && maximum - minimum <= 12) {
      data[offset + 3] = Math.round(((246 - minimum) / 21) * 255)
    }
  }

  return sharp(data, { raw: info }).png().toBuffer()
}

async function iconBuffer(size, safeArtworkSize) {
  const monogram = await transparentLogo({ left: 92, top: 72, width: 1070, height: 700 })
  const artwork = await sharp(monogram)
    .resize({
      width: safeArtworkSize,
      height: safeArtworkSize,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  return sharp({
    create: { width: size, height: size, channels: 4, background: IVORY },
  })
    .composite([{ input: artwork, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function writeIconSet() {
  const icon192 = await iconBuffer(192, 150)
  const icon512 = await iconBuffer(512, 408)
  const maskable192 = await iconBuffer(192, 124)
  const maskable512 = await iconBuffer(512, 330)
  const appleTouch = await iconBuffer(180, 142)

  await Promise.all([
    fs.writeFile(path.join(root, 'public/icon-192.png'), icon192),
    fs.writeFile(path.join(root, 'public/icon-512.png'), icon512),
    fs.writeFile(path.join(root, 'public/icons/icon-192.png'), icon192),
    fs.writeFile(path.join(root, 'public/icons/icon-512.png'), icon512),
    fs.writeFile(path.join(root, 'public/icons/maskable-icon-192.png'), maskable192),
    fs.writeFile(path.join(root, 'public/icons/maskable-icon-512.png'), maskable512),
    fs.writeFile(path.join(root, 'public/icons/apple-touch-icon.png'), appleTouch),
    fs.writeFile(path.join(playOutputDir, 'app-icon-512.png'), icon512),
  ])

  const monogram = await transparentLogo({ left: 92, top: 72, width: 1070, height: 700 })
  const badge = await sharp(monogram)
    .resize({ width: 76, height: 76, fit: 'contain' })
    .greyscale()
    .threshold(170)
    .negate({ alpha: false })
    .tint('#FFFFFF')
    .extend({ top: 10, bottom: 10, left: 10, right: 10, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  await fs.writeFile(path.join(root, 'public/icons/notification-badge.png'), badge)
}

function featureTextSvg() {
  return Buffer.from(`
    <svg width="430" height="150" xmlns="http://www.w3.org/2000/svg">
      <style>
        .headline { font: 600 38px Georgia, serif; fill: ${ESPRESSO}; }
        .detail { font: 600 18px Arial, sans-serif; fill: ${GOLD}; letter-spacing: 1px; }
      </style>
      <text x="0" y="46" class="headline">Your wedding,</text>
      <text x="0" y="94" class="headline">beautifully planned.</text>
      <text x="2" y="136" class="detail">PLAN  •  INVITE  •  CELEBRATE</text>
    </svg>
  `)
}

async function writeFeatureGraphic() {
  const background = await sharp(hero)
    .resize(1024, 500, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()
  const logo = await transparentLogo({ left: 76, top: 58, width: 1102, height: 1030 })
  const logoCardArtwork = await sharp(logo)
    .resize({
      width: 260,
      height: 218,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
  const panel = Buffer.from(`
    <svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="panel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${IVORY}" stop-opacity="1"/>
          <stop offset="0.76" stop-color="${IVORY}" stop-opacity="0.96"/>
          <stop offset="1" stop-color="${IVORY}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="500" height="500" fill="url(#panel)"/>
    </svg>
  `)

  const feature = sharp(background)
    .composite([
      { input: panel, left: 0, top: 0 },
      { input: logoCardArtwork, left: 62, top: 34 },
      { input: featureTextSvg(), left: 58, top: 304 },
    ])

  const featureBuffer = await feature.clone().png({ compressionLevel: 9 }).toBuffer()
  await fs.writeFile(path.join(playOutputDir, 'feature-graphic-1024x500.png'), featureBuffer)
  await sharp(featureBuffer)
    .flatten({ background: IVORY })
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
    .toFile(path.join(playOutputDir, 'feature-graphic-1024x500.jpg'))
}

async function writeStoreScreenshots() {
  const selected = [
    ['screenshot-02-tasks-timeline.png', 'phone-01-plan.png'],
    ['screenshot-04-guests-rsvps-seating.png', 'phone-02-guests.png'],
    ['screenshot-07-communications.png', 'phone-03-connect.png'],
  ]

  await Promise.all(selected.map(async ([input, output]) => {
    await sharp(path.join(playSourceDir, input))
      .resize(1080, 1920, { fit: 'cover', position: 'centre' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(uploadOutputDir, output))
  }))
}

await Promise.all([
  fs.mkdir(path.join(root, 'public/icons'), { recursive: true }),
  fs.mkdir(playOutputDir, { recursive: true }),
  fs.mkdir(uploadOutputDir, { recursive: true }),
])

await writeIconSet()
await writeFeatureGraphic()
await writeStoreScreenshots()

console.log('Generated Wewed PWA and Google Play image assets.')
