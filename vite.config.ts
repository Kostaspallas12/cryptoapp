import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run preview` serves the same security headers as Firebase Hosting (CSP etc.)
const firebase = JSON.parse(readFileSync(new URL('./firebase.json', import.meta.url), 'utf8'));
const previewHeaders: Record<string, string> = Object.fromEntries(
  (firebase.hosting.headers.find((h: { source?: string }) => h.source === '**')?.headers ?? [])
    .filter((h: { key: string }) => h.key !== 'Cache-Control')
    .map((h: { key: string; value: string }) => [h.key, h.value]),
);

export default defineConfig({
  plugins: [react()],
  preview: { headers: previewHeaders },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          charts: ['lightweight-charts'],
          react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'zustand'],
        },
      },
    },
  },
});
