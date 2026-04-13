import { defineConfig } from '@rsbuild/core';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { pluginSass } from '@rsbuild/plugin-sass';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      '@okalit': path.resolve(__dirname, '@okalit'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@styles': path.resolve(__dirname, 'src/styles'),
      '@guards': path.resolve(__dirname, 'src/guards'),
      '@interceptors': path.resolve(__dirname, 'src/interceptors'),
      '@layouts': path.resolve(__dirname, 'src/layouts'),
      '@channels': path.resolve(__dirname, 'src/channels'),
      '@services': path.resolve(__dirname, 'src/services'),
    },
  },
  html: {
    template: './index.html',
  },
});