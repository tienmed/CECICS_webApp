import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(__dirname, 'dist');
const srcDir = path.join(__dirname, 'src');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

// 1. Đóng gói src/core thành 1 file IIFE dùng global CECICS_CORE cho Apps Script V8
await build({
  entryPoints: [path.join(rootDir, 'src', 'core', 'index.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'CECICS_CORE',
  target: 'es2020',
  outfile: path.join(distDir, 'core.bundle.js'),
  banner: {
    js: '// AUTO-GENERATED từ src/core — KHÔNG chỉnh tay. Chạy `npm run gas:build` để cập nhật.',
  },
});

// 2. Chép appsscript.json và toàn bộ file .js trong apps-script/src
fs.copyFileSync(path.join(__dirname, 'appsscript.json'), path.join(distDir, 'appsscript.json'));

for (const file of fs.readdirSync(srcDir)) {
  if (file.endsWith('.js')) {
    fs.copyFileSync(path.join(srcDir, file), path.join(distDir, file));
  }
}

console.log('Đã đóng gói Apps Script thành công tại:', distDir);
