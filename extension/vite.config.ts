import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifestChrome from './manifest.json' with { type: 'json' };
import manifestFirefox from './manifest-firefox.json' with { type: 'json' };
import fs from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isFirefox = mode === 'firefox';
  const outDir = isFirefox ? 'dist-firefox' : 'dist-chrome';
  const manifest = isFirefox ? manifestFirefox : manifestChrome;

  return {
    plugins: [
      crx({ manifest }),
      {
        name: 'fix-sw-manifest',
        closeBundle() {
          const manifestPath = path.resolve(process.cwd(), outDir, 'manifest.json');
          if (fs.existsSync(manifestPath)) {
            const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (parsed.background && parsed.background.service_worker) {
              parsed.background.service_worker = 'background.js';
            } else if (parsed.background && parsed.background.scripts) {
              // For Firefox, ensure it points to the correct bundled background script
              parsed.background.scripts = ['background.js'];
            }
            fs.writeFileSync(manifestPath, JSON.stringify(parsed, null, 2));
            console.log(`[fix-sw-manifest] Patched ${outDir}/manifest.json`);
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
      outDir,
      emptyOutDir: true,
      target: 'esnext',
      sourcemap: false,
      rollupOptions: {
        input: {
          background: 'src/background/background.ts',
          ...(isFirefox ? {} : { offscreen: 'src/offscreen/offscreen.html' }),
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
  };
});
