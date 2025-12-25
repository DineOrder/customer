import { writable } from 'svelte/store';

export const paymentPendingCount = writable(0);
export const paymentPulse = writable(false);

export function triggerPaymentPulse() {
  paymentPulse.set(true);
  setTimeout(() => paymentPulse.set(false), 1500);
}
