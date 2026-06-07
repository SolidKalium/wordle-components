import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/wordle-components/',
  plugins: [react()],
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['**/*.test.jsx', 'jsdom'],
    ],
  },
});
