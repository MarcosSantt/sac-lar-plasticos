import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// No GitHub Pages o app fica em /sac-lar-plasticos/; localmente, na raiz.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/sac-lar-plasticos/' : '/',
  plugins: [react(), tailwindcss()],
}))
