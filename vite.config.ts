import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    minify: false,
    emptyOutDir: true,
    target: 'node20',
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'vite',
        'esbuild',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        exports: 'named',
      },
    },
  },
})
