import { defineConfig } from 'vite';

export default defineConfig({
  base: '/tower-defense/',
  build: {
    target: 'esnext',
  },
  server: {
    port: 3000,
  },
});
