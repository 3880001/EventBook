import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative path asset loading on GitHub Pages
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
          sentry: ['@sentry/browser']
        }
      }
    }
  }
});
