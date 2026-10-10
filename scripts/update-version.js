import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const buildTime = Date.now();
const isoTime = new Date().toISOString();

// 1. Write public/version.json
const versionFilePath = path.join(rootDir, 'public', 'version.json');
const versionData = {
  version: '2.0.0',
  build: buildTime,
  updatedAt: isoTime
};

fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
console.log(`✅ [Version Engine] Generated public/version.json with build: ${buildTime}`);

// 2. Update public/sw.js cache name with new build timestamp
const swFilePath = path.join(rootDir, 'public', 'sw.js');
if (fs.existsSync(swFilePath)) {
  let swContent = fs.readFileSync(swFilePath, 'utf8');
  // Replace CACHE_NAME = '...';
  swContent = swContent.replace(/const CACHE_NAME = ['"][^'"]+['"];/, `const CACHE_NAME = 'bubulink-${buildTime}';`);
  fs.writeFileSync(swFilePath, swContent, 'utf8');
  console.log(`✅ [Version Engine] Updated public/sw.js CACHE_NAME to 'bubulink-${buildTime}'`);
}
