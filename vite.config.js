import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const htmlEntries = Object.fromEntries(
  readdirSync(__dirname)
    .filter((file) => file.endsWith('.html') && !file.startsWith('Untitled-'))
    .map((file) => [file.replace(/\.html$/, ''), resolve(__dirname, file)])
);

export default defineConfig({
  build: {
    rollupOptions: {
      input: htmlEntries,
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
  },
});

