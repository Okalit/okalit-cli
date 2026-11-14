import { createRequire } from 'node:module';
import { defineConfig } from '@rsbuild/core';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { pluginSass } from '@rsbuild/plugin-sass';

const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [
    pluginSass(),
    pluginBabel({
      include: /\.(j|t)s$/,
      babelLoaderOptions: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { version: '2023-05' }],
        ],
      },
    }),
  ],
  source: {
    entry: {
      index: './src/main-app.ok',
    },
  },
  tools: {
    rspack: {
      module: {
        rules: [
          {
            test: /\.ok$/,
            type: 'javascript/auto',
            use: [{ loader: require.resolve('@okalit/engine/loader') }],
          },
        ],
      },
    },
  },
  html: {
    template: './index.html',
  },
});
