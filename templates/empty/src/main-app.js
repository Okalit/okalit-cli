import { AppMixin, defineElement, Okalit } from '@okalit/core';
import routes from './app.routes.js';

@defineElement({
  tag: 'main-app',
})
export class MainApp extends AppMixin(Okalit) {
  static config = {
    routes,
    i18n: {
      default: 'en',
      locales: ['es', 'en'],
    },
  };
}
