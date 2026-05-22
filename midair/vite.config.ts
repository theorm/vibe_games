import { defineConfig, Plugin } from 'vite'

function cacheBusterPlugin(): Plugin {
  return {
    name: 'cache-buster',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const buildId = Date.now()
        return html.replace(/(src="[^"]*\.js)(")/g, `$1?v=${buildId}$2`)
      },
    },
  }
}

export default defineConfig({
  base: '',

  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  plugins: [cacheBusterPlugin()],
})
