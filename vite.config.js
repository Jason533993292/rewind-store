import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: false, passes: 2 },
      mangle: { safari10: true },
    },
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-stripe': ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei', 'three-globe'],
        },
      },
    },
  },
  server: {
    open: true,
    port: 3000,
  },
});
