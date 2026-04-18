import { defineElement, html, Okalit, PageMixin, t } from '@okalit/core';

import global from '@styles/global.scss?inline';

@defineElement({
  tag: 'example-detail',
  styles: [global],
})
export class ExampleDetail extends PageMixin(Okalit) {
  render() {
    const id = this.routeParams.id;
    return html`
      <h2>${t('DETAIL.HEADING')}</h2>
      <div class="card">
        <p>${t('DETAIL.VIEWING')}: <strong>#${id}</strong></p>
        <p class="hint">This page is protected by a guard. Counter must be > 2.</p>
      </div>
      <button @click=${() => this.navigate('/')}>${t('DETAIL.BACK')}</button>
    `;
  }
}
