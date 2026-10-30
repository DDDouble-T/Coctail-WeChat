import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'miniprogram/assets');
const original = path.join(root, 'design/cat_coupe_icon@3x.png');

await mkdir(output, { recursive: true });

// 保留原稿的纸张底色，并使用调色板压缩，控制小程序代码包体积。
for (const name of ['cat-bartender.png', 'app-icon.png']) {
  await sharp(original)
    .resize(512, 512, { fit: 'contain', background: '#FCF8F1' })
    .png({ palette: true, colours: 128, effort: 10 })
    .toFile(path.join(output, name));
}

for (const [folder, size] of [['drinks', 400], ['tabs', 64]]) {
  const source = path.join(root, 'design', folder);
  const destination = path.join(output, folder);
  await mkdir(destination, { recursive: true });
  const files = (await readdir(source)).filter((file) => file.endsWith('.svg')).sort();

  for (const file of files) {
    await sharp(path.join(source, file), { density: 144 })
      .resize(size, size)
      .png({ palette: true, colours: 128, effort: 10 })
      .toFile(path.join(destination, file.replace(/\.svg$/, '.png')));
  }
}

for (const relative of [
  'cat-bartender.png', 'app-icon.png',
  'drinks/coupe.png', 'drinks/rocks.png', 'drinks/highball.png',
  'drinks/martini.png', 'drinks/flute.png', 'drinks/tropical.png',
  'tabs/home.png', 'tabs/home-active.png', 'tabs/bar.png', 'tabs/bar-active.png',
]) {
  const file = path.join(output, relative);
  const { size } = await stat(file);
  const limit = relative.startsWith('tabs/') ? 40 * 1024 : 300 * 1024;
  if (size > limit) throw new Error(`${relative} 超出图片体积限制：${size} bytes`);
  console.log(`${relative}: ${(size / 1024).toFixed(1)} KB`);
}
