import { getChannel } from '@okalit/core';

/**
 * Logs every navigation to the NavLog channel.
 * Interceptors run AFTER guards pass.
 * Return: true (allow), false (block), or string (redirect path).
 */
export function navLogInterceptor({ path }) {
  const channel = getChannel('app:navlog');
  if (channel) {
    const entry = `[${new Date().toLocaleTimeString()}] → ${path}`;
    channel.set([...channel.value, entry]);
  }
  return true;
}
