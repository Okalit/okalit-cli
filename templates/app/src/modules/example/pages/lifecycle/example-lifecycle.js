import { defineElement, html, Okalit, PageMixin, signal, t } from '@okalit/core';
import global from '@styles/global.scss?inline';

const names = ['Ada', 'Grace', 'Alan', 'Linus', 'Margaret'];
let idx = 0;

@defineElement({
  tag: 'example-lifecycle',
  styles: [global],
  props: [{ name: { type: String, value: 'World' } }],
})
export class ExampleLifecycle extends PageMixin(Okalit) {
  logs = signal([]);

  _log(msg) {
    this.logs.value = [...this.logs.value, `[${new Date().toLocaleTimeString()}] ${msg}`];
  }

  onInit() {
    this._log('onInit — Component initialized');
  }

  onFirstRender(changedProperties) {
    this._log('onFirstRender — Component rendered for the first time');
  }

  onChange(changes) {
    if (changes.name) {
      const { previous, current } = changes.name;
      this._log(`onChange — name: "${previous}" → "${current}"`);
    }
  }

  _changeName() {
    idx = (idx + 1) % names.length;
    this.name.value = names[idx];
  }

  render() {
    return html`
      <h2>${t('LIFECYCLE.HEADING')}</h2>

      <div class="card">
        <p>Current <code>name</code> prop: <strong>${this.name.value}</strong></p>
        <div class="controls-row">
          <button class="primary" @click=${() => this._changeName()}>${t('LIFECYCLE.CHANGE_PROP')}</button>
        </div>
        <p class="hint">Each change triggers onBeforeRender() → logged in console.</p>
      </div>

      <h3>${t('LIFECYCLE.LOG')}</h3>
      <div class="log-panel">
        ${
          this.logs.value.length === 0
            ? html`<span class="hint">No events yet…</span>`
            : this.logs.value.map((l) => html`<div class="log-entry">${l}</div>`)
        }
      </div>
      <div class="controls-row" style="margin-top:12px">
        <button @click=${() => (this.logs.value = [])}>${t('LIFECYCLE.CLEAR')}</button>
        <button @click=${() => this.navigate('/')}>← ${t('NAV.HOME')}</button>
      </div>
    `;
  }
}