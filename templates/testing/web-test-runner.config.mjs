import { playwrightLauncher } from '@web/test-runner-playwright';
import { okalitTestPlugin } from './okalit-test-plugin.mjs';

export default {
  files: ['**/*.test.js', '!node_modules/**'],
  nodeResolve: true,
  browsers: [playwrightLauncher({ product: 'chromium' })],
  plugins: [okalitTestPlugin()],
};
