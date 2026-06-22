// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://vorlis08.github.io',
  base: '/masterchef-vorlis',
  vite: {
    plugins: [tailwindcss()],
  },
});
