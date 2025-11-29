import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'plugin-vite-electron-renderer'

export default defineConfig({
  plugins: [
    electron({
      entry: 'electron/main.ts',
    }),
    renderer(),
  ],
})
