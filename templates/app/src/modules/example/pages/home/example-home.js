import { CounterChannel } from '@channels/example.channel.js';
import { defineElement, html, Okalit, PageMixin, t } from '@okalit/core';

import global from '@styles/global.scss?inline';

@defineElement({
  tag: 'example-home',
  styles: [global],
})
export class ExampleHome extends PageMixin(Okalit) {
  static channels = {
    counter: CounterChannel(),
  };

  render() {
    return html`
      <h2>${t('HOME.HEADING')}</h2>

      <div class="card">
        <h3>${t('HOME.COUNTER')}</h3>
        <div class="count">${this.counter.value}</div>
        <div class="controls-row">
          <button @click=${() => this.counter.set(this.counter.value + 1)}>+1</button>
          <button @click=${() => this.counter.set(this.counter.value - 1)}>-1</button>
          <button @click=${() => this.counter.set(0)}>${t('HOME.RESET')}</button>
        </div>
        <p class="hint">${t('HOME.COUNTER_HINT')}</p>
      </div>

      <h3>Navigation</h3>
      <div class="controls-row">
        <button class="primary" @click=${() => this.navigate('/detail/42')}>${t('HOME.GO_DETAIL', { id: '42' })}</button>
        <button @click=${() => this.navigate('/lifecycle')}>${t('HOME.GO_LIFECYCLE')}</button>
        <button @click=${() => this.navigate('/services')}>${t('HOME.GO_SERVICES')}</button>
        <button @click=${() => this.navigate('/performance')}>${t('HOME.GO_PERF')}</button>
      </div>
    `;
  }
}
