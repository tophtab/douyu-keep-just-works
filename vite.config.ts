import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  build: {
    emptyOutDir: false,
    outDir: '../../../build/docker/docker/webui',
    rollupOptions: {
      input: 'index.html',
    },
  },
  plugins: [vue()],
  root: 'src/docker/webui',
})
