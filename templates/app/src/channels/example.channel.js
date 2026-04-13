import { defineChannel } from '@okalit';

// Counter: persisted in localStorage, lives across the entire app
export const CounterChannel = defineChannel('app:counter', {
  initialValue: 0,
  persist: 'local',
  scope: 'app',
});

// Navigation log: ephemeral channel to broadcast interceptor events
export const NavLogChannel = defineChannel('app:navlog', {
  initialValue: [],
  persist: 'memory',
  scope: 'app',
});
