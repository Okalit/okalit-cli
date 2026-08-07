import { Okalit, defineElement, html } from "@okalit/core";

import styles from "./example-button.scss?inline";

@defineElement({
  tag: "example-button",
  styles: [styles],
  props: [
    { variant: { type: String, value: "primary" } },
    { disabled: { type: Boolean, value: false } },
  ],
})
export class ExampleButton extends Okalit {
  _handleClick() {
    if (this.disabled.value) return;
    this.output("on:click");
  }

  render() {
    return html`
      <button
        class="${this.variant.value} ${this.disabled.value ? 'disabled' : ''}"
        ?disabled=${this.disabled.value}
        @click=${this._handleClick}
      >
        <slot></slot>
      </button>
    `;
  }
}
