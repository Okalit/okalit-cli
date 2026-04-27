import { defineElement, getI18n, html, Okalit, PageMixin, signal, t } from '@okalit/core';

import global from '@styles/global.scss?inline';

@defineElement({
  tag: 'app-layout',
  styles: [global],
})
export class AppLayout extends PageMixin(Okalit) {
  render() {
    const locale = getI18n()?.locale.value;
    const i18n = getI18n();

    return html`
      <header class="app-header">
        <div class="app-brand">
          <img src="okalit.webp" alt="Okalit Logo" class="app-logo" />
          
          <section>
            <h1>${t('APP.TITLE')}</h1>
            <span class="app-subtitle">${t('APP.SUBTITLE')}</span>
          </section>
        </div>
        <nav class="app-nav">
          <a @click=${() => this.navigate('/')}>${t('NAV.HOME')}</a>
          <a @click=${() => this.navigate('/lifecycle')}>${t('NAV.LIFECYCLE')}</a>
          <a @click=${() => this.navigate('/services')}>${t('NAV.SERVICES')}</a>
          <a @click=${() => this.navigate('/performance')}>${t('NAV.PERFORMANCE')}</a>
        </nav>
        <div class="locale-switch">
          <button class=${locale === 'en' ? 'active' : ''} @click=${() => i18n?.setLocale('en')}>EN</button>
          <button class=${locale === 'es' ? 'active' : ''} @click=${() => i18n?.setLocale('es')}>ES</button>
        </div>
      </header>
      <main class="app-content">
        <slot></slot>
      </main>
    `;
  }
}
