import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// ДИКИЙ ИНВЕСТОР v0.1 — PWA для GitHub Pages
// Репозиторий: sibpack54-cmd/wild-investor (или zimatoken/wild-investor)
export default defineConfig({
  base: '/wild-investor/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Дикий Инвестор',
        short_name: 'ДИ-Волк',
        description: 'ZSS-сканер. Руль у тебя. Джунгли — здесь.',
        start_url: '/wild-investor/',
        display: 'standalone',
        background_color: '#0c1426',
        theme_color: '#0c1426',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
    }),
  ],
  server: { port: 5173, open: true },
});
