import { Okalit, defineElement, html } from "@okalit/core";

import styles from "./component-name.scss?inline";

@defineElement({
  tag: "component-name",
  styles: [styles],
  props: [],
})
export class ComponentName extends Okalit {
  render() {
    return html`
      <div class="component-name">
        <slot></slot>
      </div>
    `;
  }
}
