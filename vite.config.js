import { defineConfig } from 'vite';
export default defineConfig({ esbuild: { jsx: 'transform' }, server: { host: '0.0.0.0' } });
