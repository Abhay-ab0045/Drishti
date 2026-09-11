import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    crx({ manifest }),
    {
      name: 'fix-sw-manifest',
      closeBundle() {
        const manifestPath = path.resolve(process.cwd(), 'dist/manifest.json');
        if (fs.existsSync(manifestPath)) {
          const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          if (parsed.background) {
            parsed.background.service_worker = 'background.js';
          }
          fs.writeFileSync(manifestPath, JSON.stringify(parsed, null, 2));
          console.log('[fix-sw-manifest] Patched dist/manifest.json → service_worker: "background.js"');
        }
      }
    }
  ],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    rollupOptions: {
      input: {
        background: 'src/background/background.ts',
        offscreen: 'src/offscreen/offscreen.html',
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background.js';
          }
          return 'assets/[name]-[hash].js';
        }
      }
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
