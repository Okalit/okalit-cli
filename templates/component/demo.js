import '@okalit/demo-components';
import './src/component-name.js';

const demo = document.querySelector('#demo');

demo.setComponents([
  {
    name: 'ComponentName',
    tag: 'component-name',
    description: 'A component description',
    import: () => import('./src/component-name.js'),
    props: [],
    slots: [
      { name: 'default', content: 'Hello World' },
    ],
    events: [],
    channels: [],
  },
]);
