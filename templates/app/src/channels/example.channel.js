import { defineChannel } from '@okalit/core';

// Counter: persisted in localStorage, lives across the entire app
export const CounterChannel = defineChannel('app:counter', {
  initialValue: 0,
  persist: 'local',
  scope: 'app',
});
