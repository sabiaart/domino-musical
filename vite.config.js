import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Caminhos relativos: o build funciona em qualquer subdiretório
  // (ex.: GitHub Pages em usuario.github.io/repositorio/).
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js'],
  },
});
