/**
 * Drop a photo into photos-raw/ and run `npm run images`.
 *
 * Out comes a 900px WebP in public/images/ plus a ~20px blurred
 * placeholder written straight into src/data/recipes.json, so a recipe
 * shows something the moment its card scrolls into view.
 *
 * Matching is by filename: photos-raw/kure-na-paprice.jpg belongs to the
 * recipe with slug "kure-na-paprice". Anything that doesn't match a slug
 * still gets converted — it just won't be wired into a recipe.
 */

import sharp from 'sharp';
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const RAW = 'photos-raw';
const OUT = 'public/images';
const DATA = 'src/data/recipes.json';
const SITE = 'https://vorlis08.github.io/masterchef-vorlis';

const WIDTH = 900;      // covers the modal at 2x and every card at 3x
const QUALITY = 82;     // no visible loss on food photography
const LQIP_WIDTH = 20;  // blurred stand-in, inlined as base64

const kb = (n) => `${Math.round(n / 1024)} KB`;

async function main() {
  if (!existsSync(RAW)) {
    await mkdir(RAW, { recursive: true });
    console.log(`Created ${RAW}/. Put your photos there and run this again.`);
    return;
  }
  await mkdir(OUT, { recursive: true });

  const files = (await readdir(RAW)).filter((f) => /\.(jpe?g|png|webp|heic|tiff?)$/i.test(f));
  if (!files.length) {
    console.log(`No photos in ${RAW}/.`);
    return;
  }

  const recipes = JSON.parse(await readFile(DATA, 'utf-8'));
  let before = 0;
  let after = 0;
  let wired = 0;

  for (const file of files) {
    const src = path.join(RAW, file);
    const slug = path.parse(file).name;
    const dest = path.join(OUT, `${slug}.webp`);

    const input = sharp(src).rotate();          // honour EXIF orientation
    const meta = await input.metadata();

    await input
      .clone()
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(dest);

    const lqip = await input
      .clone()
      .resize({ width: LQIP_WIDTH })
      .webp({ quality: 40 })
      .toBuffer();
    const blur = `data:image/webp;base64,${lqip.toString('base64')}`;

    const inSize = (await stat(src)).size;
    const outSize = (await stat(dest)).size;
    before += inSize;
    after += outSize;

    const recipe = recipes.find((r) => r.slug === slug);
    if (recipe) {
      recipe.image = `${SITE}/images/${slug}.webp`;
      recipe.blur = blur;
      wired++;
    }

    const drop = Math.round(100 - (outSize / inSize) * 100);
    console.log(
      `${file.padEnd(34)} ${meta.width}x${meta.height} → ${WIDTH}px  ` +
      `${kb(inSize)} → ${kb(outSize)}  (-${drop}%)  ${recipe ? '✓ ' + slug : '· no matching recipe'}`
    );
  }

  if (wired) {
    await writeFile(DATA, JSON.stringify(recipes, null, 2) + '\n', 'utf-8');
  }

  console.log(
    `\n${files.length} photo(s): ${kb(before)} → ${kb(after)} ` +
    `(-${Math.round(100 - (after / before) * 100)}%). ${wired} wired into recipes.json.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
