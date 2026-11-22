// Generates the PWA icons as PNGs with no image dependency. Run: node scripts/gen-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size)
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const ACCENT = [0x44, 0x80, 0xee, 255]
const WHITE = [255, 255, 255, 255]
const CLEAR = [0, 0, 0, 0]

// A bold "H": two stems and a bar, inside a safe zone so the maskable variant never clips it.
const inH = (u, v, zone) => {
  const x = (u - (1 - zone) / 2) / zone
  const y = (v - (1 - zone) / 2) / zone
  if (x < 0 || x > 1 || y < 0 || y > 1) return false
  return x < 0.24 || x > 0.76 || (y > 0.4 && y < 0.6)
}
const roundedSquare = (u, v, r) => {
  const dx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0)
  const dy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0)
  return dx * dx + dy * dy <= r * r
}

const make = (name, size, { maskable = false, rounded = true } = {}) => {
  const zone = maskable ? 0.5 : 0.56
  const buf = png(size, (u, v) => {
    if (!maskable && rounded && !roundedSquare(u, v, 0.22)) return CLEAR
    return inH(u, v, zone) ? WHITE : ACCENT
  })
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), buf)
  console.log(`wrote public/icons/${name} (${buf.length} bytes)`)
}

make('icon-192.png', 192)
make('icon-512.png', 512)
make('maskable-512.png', 512, { maskable: true })
make('apple-touch-icon.png', 180, { rounded: false })
