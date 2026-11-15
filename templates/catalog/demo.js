import '@okalit/demo-components';

const catalog = document.querySelector('#catalog');

catalog.setComponents([
  {
    name: 'Example Button',
    tag: 'example-button',
    description: 'A button with variants, disabled state and a click event.',
    import: () => import('./components/example-button/example-button.js'),
    props: [
      { variant: { type: String, value: 'primary' } },
      { disabled: { type: Boolean, value: false } },
    ],
    slots: [{ name: 'default', content: 'Click me' }],
    events: ['on:click'],
    channels: [],
  },
]);
