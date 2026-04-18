import { defineElement, ModuleMixin, Okalit } from '@okalit/core';
import global from '@styles/global.scss?inline';

@defineElement({
  tag: 'example-module',
  styles: [global],
})
export class ExampleModule extends ModuleMixin(Okalit) {}
