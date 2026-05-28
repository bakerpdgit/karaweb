import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Stamped once when `vite build` (or `vite dev`) starts. Used as
//   - the value of `__BUILD_TIME__` inlined into every JS bundle, and
//   - the body of `dist/version.json` written by the closeBundle hook.
// The deployed app fetches /version.json at mount + on tab-focus and
// compares to the baked-in __BUILD_TIME__ to detect "a new version is
// available, please reload".
const buildTime = new Date().toISOString();

export default defineConfig({
  plugins: [
    react(),
    {
      // Writes dist/version.json after the bundle closes. Only runs on
      // production builds (vite build) — dev server never hits closeBundle.
      name: 'karaweb-version-stamp',
      closeBundle() {
        try {
          writeFileSync(
            join('dist', 'version.json'),
            JSON.stringify({ buildTime }) + '\n',
          );
        } catch (err) {
          // Non-fatal; the app handles a missing version.json gracefully.
          console.warn('karaweb-version-stamp: failed to write version.json:', err?.message ?? err);
        }
      },
    },
  ],
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  base: '/',
});
