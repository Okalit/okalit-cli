import { defineElement, html, Okalit } from '@okalit/core';

@defineElement({ tag: 'lazy-widget' })
export class LazyWidget extends Okalit {
  render() {
    return html`
      <div style="padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">
        <strong>Lazy Widget loaded!</strong>
        <p style="margin:4px 0 0;font-size:0.85rem;color:#555">This component was dynamically imported.</p>
      </div>
    `;
  }
}
