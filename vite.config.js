import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Use repo-name base on GitHub Actions so asset paths work under /karaport/
  base: process.env.GITHUB_ACTIONS ? '/karaport/' : '/',
});
