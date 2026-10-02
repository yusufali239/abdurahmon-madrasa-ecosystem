import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Корневой .env общий для всех частей проекта (VITE_* переменные)
export default defineConfig({
  // VITE_BASE=/app/ (или /admin/) — когда фронтенд раздаётся самим backend'ом
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  envDir: '..',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: { port: 5173, host: true, fs: { allow: ['..'] } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          media: ['wavesurfer.js', 'plyr'],
        },
      },
    },
  },
});
