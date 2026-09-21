/**
 * scripts/copy-wasm.mjs
 * Post-build script: copies ONNX Runtime and MediaPipe WASM binaries
 * into the extension's dist/ folder so they can be loaded at runtime
 * without violating MV3's strict Content Security Policy.
 */
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDirName = process.argv[2] || 'dist-chrome';
const dist = resolve(root, outDirName);

// ===== ONNX Runtime Web WASM files =====
const ortDist = resolve(root, 'node_modules/onnxruntime-web/dist');
const wasmOut = resolve(dist, 'wasm');
mkdirSync(wasmOut, { recursive: true });

if (existsSync(ortDist)) {
  const copied = [];
  for (const f of readdirSync(ortDist)) {
    if (f.endsWith('.wasm')) {
      copyFileSync(join(ortDist, f), join(wasmOut, f));
      copied.push(f);
    }
  }
  console.log(`[copy-wasm] ONNX Runtime: ${copied.length} WASM file(s) → dist/wasm/`);
  copied.forEach((f) => console.log(`  ✓ ${f}`));
} else {
  console.warn('[copy-wasm] ⚠ onnxruntime-web dist/ not found');
}

// ===== MediaPipe Vision WASM files =====
const mpWasm = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const mpOut = resolve(dist, 'mediapipe');
mkdirSync(mpOut, { recursive: true });

if (existsSync(mpWasm)) {
  const copied = [];
  for (const f of readdirSync(mpWasm)) {
    copyFileSync(join(mpWasm, f), join(mpOut, f));
    copied.push(f);
  }
  console.log(`[copy-wasm] MediaPipe: ${copied.length} file(s) → dist/mediapipe/`);
  copied.forEach((f) => console.log(`  ✓ ${f}`));
} else {
  console.warn('[copy-wasm] ⚠ @mediapipe/tasks-vision wasm/ not found');
}

// ===== MediaPipe Model Assets (bundled locally) =====
const modelSrc = resolve(root, 'src/models');
const modelOut = resolve(dist, 'models');
mkdirSync(modelOut, { recursive: true });

if (existsSync(modelSrc)) {
  const copied = [];
  for (const f of readdirSync(modelSrc)) {
    if (f.endsWith('.tflite')) {
      copyFileSync(join(modelSrc, f), join(modelOut, f));
      copied.push(f);
    }
  }
  console.log(`[copy-wasm] MediaPipe models: ${copied.length} file(s) → dist/models/`);
  copied.forEach((f) => console.log(`  ✓ ${f}`));
} else {
  console.warn('[copy-wasm] ⚠ src/models/ not found');
}

// ===== Test Assets =====
const testAssetsSrc = resolve(root, 'src/test-assets');
const testAssetsOut = resolve(dist, 'test-assets');
mkdirSync(testAssetsOut, { recursive: true });

if (existsSync(testAssetsSrc)) {
  const copied = [];
  for (const f of readdirSync(testAssetsSrc)) {
    copyFileSync(join(testAssetsSrc, f), join(testAssetsOut, f));
    copied.push(f);
  }
  console.log(`[copy-wasm] Test assets: ${copied.length} file(s) → dist/test-assets/`);
  copied.forEach((f) => console.log(`  ✓ ${f}`));
} else {
  console.warn('[copy-wasm] ⚠ src/test-assets/ not found');
}


// ===== Extension Icons =====
const iconSrc = resolve(root, 'assets/icons');
const iconOut = resolve(dist, 'assets/icons');
mkdirSync(iconOut, { recursive: true });

if (existsSync(iconSrc)) {
  const copied = [];
  for (const f of readdirSync(iconSrc)) {
    if (f.endsWith('.png')) {
      copyFileSync(join(iconSrc, f), join(iconOut, f));
      copied.push(f);
    }
  }
  console.log(`[copy-wasm] Icons: ${copied.length} file(s) → dist/assets/icons/`);
  copied.forEach((f) => console.log(`  ✓ ${f}`));
} else {
  console.warn('[copy-wasm] ⚠ assets/icons/ not found');
}

console.log('[copy-wasm] Done.');
