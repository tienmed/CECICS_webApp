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

// 3. Tạo file ALL_IN_ONE_CODE.js gộp toàn bộ để dễ dàng copy vào Apps Script Editor
const allInOneHeader = `// ============================================================================
// CECICS WEB APP - APPS SCRIPT ALL-IN-ONE GATEWAY
// Tự động đóng gói toàn bộ Core, Store, Calendar, Mail, Triggers và Web App Endpoint
// ============================================================================
`;

const order = ['core.bundle.js', 'store.js', 'calendar.js', 'mail.js', 'setup.js', 'triggers.js', 'main.js'];
const concatenated = [allInOneHeader];

for (const name of order) {
  const filePath = path.join(distDir, name);
  if (fs.existsSync(filePath)) {
    concatenated.push(`\n// --- BEGIN ${name} ---\n`);
    concatenated.push(fs.readFileSync(filePath, 'utf8'));
    concatenated.push(`\n// --- END ${name} ---\n`);
  }
}

fs.writeFileSync(path.join(distDir, 'ALL_IN_ONE_CODE.js'), concatenated.join('\n'), 'utf8');

console.log('Đã đóng gói Apps Script thành công tại:', distDir);
console.log('File All-In-One sẵn sàng:', path.join(distDir, 'ALL_IN_ONE_CODE.js'));
