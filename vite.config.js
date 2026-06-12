import { defineConfig } from 'vite';

export default defineConfig({
  // Racine du projet = dossier courant
  root: '.',

  // Serveur de développement
  server: {
    port: 5173,
    open: true,
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
});