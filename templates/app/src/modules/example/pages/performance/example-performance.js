import { defineElement, html, Okalit, PageMixin, signal, t } from '@okalit/core';
import '@okalit/core/performance.js';

import global from '@styles/global.scss?inline';

const loadWidget = () => import('@components/lazy-widget.js');

@defineElement({
  tag: 'example-performance',
  styles: [global],
})
export class ExamplePerformance extends PageMixin(Okalit) {
  showConditional = signal(false);

  render() {
    return html`
      <h2>${t('PERF.HEADING')}</h2>

      <div class="card">
        <h3>&lt;o-idle&gt;</h3>
        <p class="hint">${t('PERF.IDLE_LABEL')}</p>
        <o-idle .loader=${loadWidget}>
          <lazy-widget></lazy-widget>
          <p slot="fallback" class="fallback">⏳ Waiting for idle…</p>
        </o-idle>
      </div>

      <div class="card">
        <h3>&lt;o-when&gt;</h3>
        <p class="hint">${t('PERF.WHEN_LABEL')}</p>
        <div class="controls-row" style="margin-bottom:12px">
          <button class="primary" @click=${() => (this.showConditional.value = true)}>
            ${t('PERF.TOGGLE')}
          </button>
          <span class="hint">condition = ${this.showConditional.value ? 'true' : 'false'}</span>
        </div>
        <o-when .condition=${this.showConditional.value} .loader=${loadWidget}>
          <lazy-widget></lazy-widget>
          <p slot="fallback" class="fallback">⏳ Waiting for condition…</p>
        </o-when>
      </div>

      <div class="card">
        <h3>&lt;o-viewport&gt;</h3>
        <p class="hint">${t('PERF.VIEWPORT_LABEL')}</p>
        <p class="hint">${t('PERF.SCROLL_HINT')}</p>
        <div class="spacer"></div>
        <o-viewport .loader=${loadWidget}>
          <lazy-widget></lazy-widget>
          <p slot="fallback" class="fallback">⏳ Waiting for viewport…</p>
        </o-viewport>
      </div>

      <div class="controls-row" style="margin-top:12px">
        <button @click=${() => this.navigate('/')}>← ${t('NAV.HOME')}</button>
      </div>
    `;
  }
}
