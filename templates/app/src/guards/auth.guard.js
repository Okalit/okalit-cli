import { getChannel } from '@okalit/core';

/**
 * Blocks navigation unless the counter value is greater than 2.
 * Reads directly from localStorage (where CounterChannel persists).
 *
 * Guards run BEFORE the dynamic import — no code is loaded if they fail.
 * Return: true (allow), false (block), or string (redirect path).
 */
export function authGuard() {
  const channel = getChannel('app:counter');
  const count = channel ? channel.value : 0;

  return count <= 2 ? '/' : true;
}
