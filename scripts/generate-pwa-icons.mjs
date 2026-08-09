/**
 * Regenerates every PWA/favicon icon from the source Athelite lockup.
 *
 * The source artwork is the full "AthElite Sports Management" lockup (runner
 * mark + wordmark + tagline, on white). For an app icon we want just the
 * runner mark: crop the top portion, chroma-key the white background to
 * transparent (the source PNG has no alpha channel), and composite it onto a
 * solid canvas sized so the mark stays inside Android's maskable safe zone
 * (content within ~40% of canvas radius from centre).
 *
 * Run with: node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';

const SOURCE_PNG =
  'C:/Users/atipr/SourceCode/Athelite/Athelite-SITE/Fable-001/.claude/worktrees/site-design-seo-overhaul-607898/public/brand/athelite-logo.png';

const TOP_FRACTION = 0.54; // crop out the wordmark/tagline below the mark
const BOTTOM_KEEP = 0.93; // trims a faint drop-shadow sliver under the feet
const BG_COLOR = '#f4f1ea'; // matches --paper

/** Crops the runner mark from the source lockup and keys white to transparent. */
async function extractMark() {
  const meta = await sharp(SOURCE_PNG).metadata();
  const cropHeight = Math.round(meta.height * TOP_FRACTION);

  const croppedBuf = await sharp(SOURCE_PNG)
    .extract({ left: 0, top: 0, width: meta.width, height: cropHeight })
    .toBuffer();

  const trimmed = await sharp(croppedBuf).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  const { data, info } = await sharp(trimmed.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const keyed = Buffer.from(data);
  for (let i = 0; i < keyed.length; i += info.channels) {
    // A steep threshold so anti-aliasing and drop-shadow artefacts resolve to
    // fully transparent instead of a grey ghost, while the ink stays opaque.
    const whiteness = Math.min(keyed[i], keyed[i + 1], keyed[i + 2]);
    keyed[i + 3] = Math.max(0, Math.min(255, (215 - whiteness) * 3));
  }

  const keptHeight = Math.round(info.height * BOTTOM_KEEP);
  return {
    buffer: keyed,
    width: info.width,
    height: info.height,
    keptHeight,
    channels: info.channels,
  };
}

/** Composites the mark onto a square canvas, monochrome and colour share this. */
async function compose({ mark, canvas, contentFraction, background, forceBlack }) {
  let img = sharp(mark.buffer, {
    raw: { width: mark.width, height: mark.height, channels: mark.channels },
  }).extract({ left: 0, top: 0, width: mark.width, height: mark.keptHeight });

  if (forceBlack) {
    // Android's themed-icon layer only reads alpha; recolour to solid black
    // so the OS can re-tint it to the user's wallpaper palette.
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const blacked = Buffer.from(data);
    for (let i = 0; i < blacked.length; i += info.channels) {
      blacked[i] = 0;
      blacked[i + 1] = 0;
      blacked[i + 2] = 0;
    }
    img = sharp(blacked, { raw: { width: info.width, height: info.height, channels: info.channels } });
  }

  const targetContent = Math.round(canvas * contentFraction);
  const scale = targetContent / Math.max(mark.width, mark.keptHeight);
  const resizedW = Math.round(mark.width * scale);
  const resizedH = Math.round(mark.keptHeight * scale);
  const resized = await img.resize(resizedW, resizedH).png().toBuffer();

  return sharp({ create: { width: canvas, height: canvas, channels: 4, background } })
    .composite([{ input: resized, left: Math.round((canvas - resizedW) / 2), top: Math.round((canvas - resizedH) / 2) }])
    .png()
    .toBuffer();
}

const mark = await extractMark();

// The colour master: generous safe-zone padding, used for every "any" and
// "maskable" icon plus the favicons.
const master = await compose({ mark, canvas: 1024, contentFraction: 0.74, background: BG_COLOR });
await sharp(master).toFile('scripts/assets/master.png');

const sizes = [
  { file: 'public/pwa-192x192.png', size: 192 },
  { file: 'public/pwa-512x512.png', size: 512 },
  { file: 'public/maskable-icon-512x512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/favicon-48x48.png', size: 48 },
  { file: 'public/favicon-32x32.png', size: 32 },
];
for (const t of sizes) {
  await sharp(master).resize(t.size, t.size).png().toFile(t.file);
  console.log('wrote', t.file, `${t.size}x${t.size}`);
}

// Android 13+ themed icon: transparent background, solid silhouette, tighter
// content fraction since the OS crops these more aggressively than maskable.
const monochrome = await compose({
  mark,
  canvas: 512,
  contentFraction: 0.62,
  background: { r: 0, g: 0, b: 0, alpha: 0 },
  forceBlack: true,
});
await sharp(monochrome).toFile('public/monochrome-icon-512x512.png');
console.log('wrote public/monochrome-icon-512x512.png 512x512');
console.log('wrote scripts/assets/master.png 1024x1024 (source, not shipped)');
