const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  buf.writeUInt32BE(crc32(typeAndData), 8 + len);
  return buf;
}

function encodeRGBAtoPNG(width, height, rgbaBuffer) {
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);
  for (let y = 0; y < height; y++) {
    const rawOffset = y * scanlineLength;
    rawData[rawOffset] = 0; // Filter 0: None
    rgbaBuffer.copy(rawData, rawOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function decodePNGToRGBA(buf) {
  let offset = 8;
  const chunks = [];
  let width, height, bitDepth, colorType;

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === 'IDAT') {
      chunks.push(data);
    }
  }

  const decompressed = zlib.inflateSync(Buffer.concat(chunks));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * bpp;

  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return (pa <= pb && pa <= pc) ? a : (pb <= pc) ? b : c;
  }

  const rawPixels = Buffer.alloc(width * height * bpp);
  let srcPos = 0;
  for (let y = 0; y < height; y++) {
    const filter = decompressed[srcPos++];
    const rowStart = y * stride;
    for (let x = 0; x < stride; x++) {
      const raw = decompressed[srcPos++];
      const left = x >= bpp ? rawPixels[rowStart + x - bpp] : 0;
      const up = y > 0 ? rawPixels[rowStart - stride + x] : 0;
      const upLeft = (y > 0 && x >= bpp) ? rawPixels[rowStart - stride + x - bpp] : 0;
      let val = 0;
      if (filter === 0) val = raw;
      else if (filter === 1) val = (raw + left) & 0xff;
      else if (filter === 2) val = (raw + up) & 0xff;
      else if (filter === 3) val = (raw + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) val = (raw + paeth(left, up, upLeft)) & 0xff;
      rawPixels[rowStart + x] = val;
    }
  }

  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (colorType === 6) {
      out[i * 4] = rawPixels[i * 4];
      out[i * 4 + 1] = rawPixels[i * 4 + 1];
      out[i * 4 + 2] = rawPixels[i * 4 + 2];
      out[i * 4 + 3] = rawPixels[i * 4 + 3];
    } else if (colorType === 2) {
      out[i * 4] = rawPixels[i * 3];
      out[i * 4 + 1] = rawPixels[i * 3 + 1];
      out[i * 4 + 2] = rawPixels[i * 3 + 2];
      out[i * 4 + 3] = 255;
    }
  }
  return { width, height, rgba: out };
}

// Function to remove white corners from a squircle badge image
function removeWhiteCorners(width, height, rgba) {
  const result = Buffer.from(rgba);
  const cornerLimit = Math.floor(Math.min(width, height) * 0.22); // corner zone
  
  // Find typical dark tile background color from near-corner inside region
  const sampleX = cornerLimit + 2;
  const sampleY = cornerLimit + 2;
  const sampleIdx = (sampleY * width + sampleX) * 4;
  const darkR = rgba[sampleIdx];
  const darkG = rgba[sampleIdx + 1];
  const darkB = rgba[sampleIdx + 2];
  const darkLum = 0.299 * darkR + 0.587 * darkG + 0.114 * darkB;

  // We check each pixel in the 4 corner zones
  function isCornerZone(x, y) {
    const fromLeft = x;
    const fromRight = width - 1 - x;
    const fromTop = y;
    const fromBottom = height - 1 - y;

    const inTopLeft = fromLeft <= cornerLimit && fromTop <= cornerLimit;
    const inTopRight = fromRight <= cornerLimit && fromTop <= cornerLimit;
    const inBottomLeft = fromLeft <= cornerLimit && fromBottom <= cornerLimit;
    const inBottomRight = fromRight <= cornerLimit && fromBottom <= cornerLimit;

    return inTopLeft || inTopRight || inBottomLeft || inBottomRight;
  }

  // Flood fill from all 4 corners to find contiguous white/near-white area
  const visited = new Uint8Array(width * height);
  const queue = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  for (const [x, y] of queue) {
    visited[y * width + x] = 1;
  }

  let head = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const idx = (cy * width + cx) * 4;
    const r = rgba[idx];
    const g = rgba[idx + 1];
    const b = rgba[idx + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Check neighbors
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (!visited[ny * width + nx] && isCornerZone(nx, ny)) {
          const nIdx = (ny * width + nx) * 4;
          const nr = rgba[nIdx];
          const ng = rgba[nIdx + 1];
          const nb = rgba[nIdx + 2];
          const nLum = 0.299 * nr + 0.587 * ng + 0.114 * nb;
          
          // If neighbor is significantly lighter than dark tile background, it belongs to the corner transition
          if (nLum > darkLum + 15) {
            visited[ny * width + nx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  // Now process all visited corner pixels
  let transparentCount = 0;
  let blendedCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[y * width + x]) {
        const idx = (y * width + x) * 4;
        const r = rgba[idx];
        const g = rgba[idx + 1];
        const b = rgba[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (lum >= 248) {
          // Pure white corner -> 100% transparent
          result[idx] = 0;
          result[idx + 1] = 0;
          result[idx + 2] = 0;
          result[idx + 3] = 0;
          transparentCount++;
        } else {
          // Antialiased edge against white: unblend
          // lum = alpha * darkLum + (1 - alpha) * 255
          // => 255 - lum = alpha * (255 - darkLum)
          const alpha = Math.max(0, Math.min(1, (255 - lum) / (255 - darkLum)));
          const aByte = Math.round(alpha * 255);
          if (aByte <= 5) {
            result[idx] = 0;
            result[idx + 1] = 0;
            result[idx + 2] = 0;
            result[idx + 3] = 0;
            transparentCount++;
          } else {
            // Unblend color components: C_fg = (C - (1 - a) * 255) / a
            const unblend = (c) => Math.max(0, Math.min(255, Math.round((c - (1 - alpha) * 255) / alpha)));
            result[idx] = unblend(r);
            result[idx + 1] = unblend(g);
            result[idx + 2] = unblend(b);
            result[idx + 3] = aByte;
            blendedCount++;
          }
        }
      }
    }
  }

  console.log(`Processed ${width}x${height}: ${transparentCount} transparent, ${blendedCount} antialiased`);
  return result;
}

// Resample RGBA image with high quality area averaging
function resizeRGBA(srcWidth, srcHeight, srcRgba, dstWidth, dstHeight) {
  const dst = Buffer.alloc(dstWidth * dstHeight * 4);
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let dy = 0; dy < dstHeight; dy++) {
    const syStart = dy * yRatio;
    const syEnd = (dy + 1) * yRatio;
    const sy0 = Math.floor(syStart);
    const sy1 = Math.min(srcHeight - 1, Math.floor(syEnd));

    for (let dx = 0; dx < dstWidth; dx++) {
      const sxStart = dx * xRatio;
      const sxEnd = (dx + 1) * xRatio;
      const sx0 = Math.floor(sxStart);
      const sx1 = Math.min(srcWidth - 1, Math.floor(sxEnd));

      let totalWeight = 0;
      let accR = 0, accG = 0, accB = 0, accA = 0;

      for (let sy = sy0; sy <= sy1; sy++) {
        const yWeight = Math.min(sy + 1, syEnd) - Math.max(sy, syStart);
        for (let sx = sx0; sx <= sx1; sx++) {
          const xWeight = Math.min(sx + 1, sxEnd) - Math.max(sx, sxStart);
          const weight = xWeight * yWeight;
          const sIdx = (sy * srcWidth + sx) * 4;
          const a = srcRgba[sIdx + 3] / 255;

          // Premultiplied accumulation
          accR += srcRgba[sIdx] * a * weight;
          accG += srcRgba[sIdx + 1] * a * weight;
          accB += srcRgba[sIdx + 2] * a * weight;
          accA += a * weight;
          totalWeight += weight;
        }
      }

      const outA = accA / totalWeight;
      const dIdx = (dy * dstWidth + dx) * 4;
      if (outA <= 0.001) {
        dst[dIdx] = 0;
        dst[dIdx + 1] = 0;
        dst[dIdx + 2] = 0;
        dst[dIdx + 3] = 0;
      } else {
        dst[dIdx] = Math.max(0, Math.min(255, Math.round(accR / accA)));
        dst[dIdx + 1] = Math.max(0, Math.min(255, Math.round(accG / accA)));
        dst[dIdx + 2] = Math.max(0, Math.min(255, Math.round(accB / accA)));
        dst[dIdx + 3] = Math.max(0, Math.min(255, Math.round(outA * 255)));
      }
    }
  }
  return dst;
}

// Build multi-icon ICO file from array of { width, height, pngBuffer }
function buildICO(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(count, 4);

  let currentOffset = 6 + count * 16;
  const directoryEntries = [];
  const imageBuffers = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(img.pngBuffer.length, 8); // size
    entry.writeUInt32LE(currentOffset, 12); // offset

    directoryEntries.push(entry);
    imageBuffers.push(img.pngBuffer);
    currentOffset += img.pngBuffer.length;
  }

  return Buffer.concat([header, ...directoryEntries, ...imageBuffers]);
}

// MAIN PROCESS
function run() {
  console.log('--- Processing Logos & Favicons ---');
  
  // 1. Process apple-touch-icon.png (180x180)
  const appleTouchPath = path.resolve('apps/public/public/apple-touch-icon.png');
  const appleData = fs.readFileSync(appleTouchPath);
  const appleDecoded = decodePNGToRGBA(appleData);
  const appleCleaned = removeWhiteCorners(appleDecoded.width, appleDecoded.height, appleDecoded.rgba);
  const applePNG = encodeRGBAtoPNG(appleDecoded.width, appleDecoded.height, appleCleaned);

  // 2. Generate clean favicon.png (64x64) directly by downscaling from high-res 180x180 cleaned image
  // This yields the crispest possible antialiasing and detail!
  const fav64RGBA = resizeRGBA(appleDecoded.width, appleDecoded.height, appleCleaned, 64, 64);
  const fav64PNG = encodeRGBAtoPNG(64, 64, fav64RGBA);

  // 3. Generate multi-resolution icons for ICO (16x16, 32x32, 48x48, 64x64)
  const fav16RGBA = resizeRGBA(appleDecoded.width, appleDecoded.height, appleCleaned, 16, 16);
  const fav16PNG = encodeRGBAtoPNG(16, 16, fav16RGBA);

  const fav32RGBA = resizeRGBA(appleDecoded.width, appleDecoded.height, appleCleaned, 32, 32);
  const fav32PNG = encodeRGBAtoPNG(32, 32, fav32RGBA);

  const fav48RGBA = resizeRGBA(appleDecoded.width, appleDecoded.height, appleCleaned, 48, 48);
  const fav48PNG = encodeRGBAtoPNG(48, 48, fav48RGBA);

  const icoBuffer = buildICO([
    { width: 16, height: 16, pngBuffer: fav16PNG },
    { width: 32, height: 32, pngBuffer: fav32PNG },
    { width: 48, height: 48, pngBuffer: fav48PNG },
    { width: 64, height: 64, pngBuffer: fav64PNG },
  ]);

  // Write to both apps/public/public and apps/dashboard/public
  const targets = [
    'apps/public/public',
    'apps/dashboard/public',
  ];

  for (const targetDir of targets) {
    fs.writeFileSync(path.join(targetDir, 'apple-touch-icon.png'), applePNG);
    fs.writeFileSync(path.join(targetDir, 'favicon.png'), fav64PNG);
    fs.writeFileSync(path.join(targetDir, 'favicon.ico'), icoBuffer);
    console.log(`Updated assets in ${targetDir}`);
  }

  console.log('All favicons and touch icons successfully updated with transparent corners!');
}

run();
