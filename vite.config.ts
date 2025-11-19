import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  plugins: [
    react(),

    /* ---------- ELECTRON MAIN & PRELOAD ---------- */
    electron([
      {
        // MAIN PROCESS (full Node.js)
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // electron & any native deps are fine here
              external: ['electron', 'mssql', 'mongodb', 'kerberos'],
            },
          },
        },
      },
      {
        // PRELOAD (also Node.js, but isolated)
        entry: 'electron/preload.ts',
        onstart({ reload }: any) {
          reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'smart-buffer', 'mongodb', 'kerberos'],
            },
          },
        },
      },
    ]),

    /* ---------- RENDERER (Vite bundle) ---------- */
    renderer({
      // <-- this is the key part for the renderer
      optimizeDeps: {
        exclude: ['mongodb', 'kerberos'],
      },
      // Make the renderer treat mongodb & kerberos as external
      // (they will be undefined at runtime – which is fine because you never import them)
      resolve: {
        alias: {
          mongodb: false,
          kerberos: false,
          'kerberos.node': false,
        },
      },
    }),

    /* ---------- SAFETY PLUGIN ---------- */
    {
      name: 'block-native-modules',
      enforce: 'pre',
      resolveId(source) {
        if (source.includes('kerberos') || source.endsWith('.node')) {
          throw new Error(
            `Cannot import native module "${source}" in renderer. Use main process.`
          );
        }
        return null;
      },
    },
  ],

  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    // <-- RENDERER rollup options
    rollupOptions: {
      external: ['mongodb', 'kerberos'], // <-- CRUCIAL
    },
  },

  resolve: {
    alias: {
      // Same aliases for dev & build
      mongodb: false,
      kerberos: false,
      'kerberos.node': false,
    },
  },

  optimizeDeps: {
    exclude: ['mongodb', 'kerberos'],
  },

  // Tell Rollup not to try to read .node files as assets
  assetsInclude: ['**/*.node'],
});