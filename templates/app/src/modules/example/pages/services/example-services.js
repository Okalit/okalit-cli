import { defineElement, html, inject, Okalit, PageMixin, signal, t } from '@okalit';

import '@services/user.service.js';
import '@services/rickandmorty.service.js';

import global from '@styles/global.scss?inline';

@defineElement({
  tag: 'example-services',
  styles: [global],
})
export class ExampleServices extends PageMixin(Okalit) {
  userApi = inject('user');
  gqlApi = inject('rickandmorty');

  users = signal([]);
  characters = signal([]);
  restLoading = signal(false);
  gqlLoading = signal(false);
  restError = signal(null);
  gqlError = signal(null);

  onInit() {
    this.userApi.getUsers().fire({
      onLoading: (v) => (this.restLoading.value = v),
      onSuccess: (data) => (this.users.value = data.slice(0, 6)),
      onError: (err) => (this.restError.value = err),
    });

    this.gqlApi.getCharacters().fire({
      onLoading: (v) => (this.gqlLoading.value = v),
      onSuccess: (data) => (this.characters.value = data.characters.results),
      onError: (err) => (this.gqlError.value = err),
    });
  }

  render() {
    return html`
      <h2>${t('SERVICES.HEADING')}</h2>

      <div class="card">
        <h3>${t('SERVICES.REST_TITLE')}</h3>
        <p class="hint">OkalitService + cache: true + fire({ onLoading, onSuccess, onError })</p>
        ${
          this.restLoading.value
            ? html`<p class="fallback">${t('SERVICES.LOADING')}</p>`
            : this.restError.value
              ? html`<p class="fallback">${t('SERVICES.ERROR')}</p>`
              : html`
              <ul class="data-list">
                ${this.users.value.map(
                  (u) => html`
                  <li><strong>${u.name}</strong> — ${u.email}</li>
                `,
                )}
              </ul>
            `
        }
      </div>

      <div class="card">
        <h3>${t('SERVICES.GQL_TITLE')}</h3>
        <p class="hint">OkalitGraphqlService + .query() + cache</p>
        ${
          this.gqlLoading.value
            ? html`<p class="fallback">${t('SERVICES.LOADING')}</p>`
            : this.gqlError.value
              ? html`<p class="fallback">${t('SERVICES.ERROR')}</p>`
              : html`
              <ul class="data-list">
                ${this.characters.value.map(
                  (c) => html`
                  <li><strong>${c.name}</strong></li>
                `,
                )}
              </ul>
            `
        }
      </div>

      <div class="controls-row" style="margin-top:12px">
        <button @click=${() => this.navigate('/')}>← ${t('NAV.HOME')}</button>
      </div>
    `;
  }
}
