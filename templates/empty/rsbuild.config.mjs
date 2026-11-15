import { defineConfig } from '@rsbuild/core';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { pluginSass } from '@rsbuild/plugin-sass';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [
    pluginSass(),
    pluginBabel({
      include: /\.(j|t)s$/,
      babelLoaderOptions: {
        plugins: [
          ["@babel/plugin-proposal-decorators", { "version": "2023-05" }]
        ],
      },
    }),
  ],
  source: {
    entry: {
      index: './src/main-app.js', 
    },
  },
  resolve: {
    alias: {
      '@catalogs': path.resolve(__dirname, 'src/catalogs'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@styles': path.resolve(__dirname, 'src/styles'),
    },
  },
  html: {
    template: './index.html',
  },
  tools: {
    rspack: {
      module: {
        rules: [{
          test: /\.ok$/,
          type: 'javascript/auto',
          use: [{ loader: require.resolve('@okalit/engine/loader') }],
        }],
      },
    },
  },
});