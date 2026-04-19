import { AppMixin, defineElement, html, Okalit } from '@okalit/core';
import routes from './app.routes.js';

import '@styles/index.css';
import '@layouts/app-layout.js';

@defineElement({
  tag: 'main-app',
})
export class MainApp extends AppMixin(Okalit) {
  static config = {
    routes,
    template: (slot) => html`<app-layout>${slot}</app-layout>`,
    i18n: {
      default: 'en',
      locales: ['es', 'en'],
    },
  };
}
