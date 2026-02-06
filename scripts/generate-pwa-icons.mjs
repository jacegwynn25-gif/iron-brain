import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [srcArg, outArg] = process.argv.slice(2);

if (!srcArg) {
  console.error('Usage: node scripts/generate-pwa-icons.mjs <source.png> [outputDir]');
  console.error('Example: node scripts/generate-pwa-icons.mjs public/apple-touch-icon.png public/icons');
  process.exit(1);
}

const srcPath = path.resolve(srcArg);
const outDir = path.resolve(outArg ?? 'public/icons');

await fs.mkdir(outDir, { recursive: true });

const meta = await sharp(srcPath).metadata();
const maxSide = Math.max(meta.width ?? 0, meta.height ?? 0);
if (!maxSide) {
  throw new Error('Could not read source image dimensions.');
}

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const sizes = [
  { name: 'icon-1024.png', size: 1024 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
];

const baseSquare = sharp(srcPath)
  .resize({ width: maxSide, height: maxSide, fit: 'contain', background: transparent })
  .png();

for (const { name, size } of sizes) {
  await baseSquare
    .clone()
    .resize({ width: size, height: size, fit: 'contain', background: transparent })
    .png()
    .toFile(path.join(outDir, name));
}

// Maskable icon with ~80% safe zone padding
const maskSize = 512;
const safeScale = 0.8;
const innerSize = Math.round(maskSize * safeScale);

const innerBuffer = await baseSquare
  .clone()
  .resize({ width: innerSize, height: innerSize, fit: 'contain', background: transparent })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: maskSize,
    height: maskSize,
    channels: 4,
    background: transparent,
  },
})
  .composite([{ input: innerBuffer, gravity: 'center' }])
  .png()
  .toFile(path.join(outDir, 'icon-maskable-512.png'));

console.log(`Generated icons in ${outDir}`);
