import { defineElement, html, Okalit, PageMixin } from '@okalit/core';

import global from '@styles/global.scss?inline';

@defineElement({
  tag: 'example-home',
  styles: [global],
})
export class ExampleHome extends PageMixin(Okalit) {
  render() {
    return html`<h1>Empty Project</h1>`;
  }
}
