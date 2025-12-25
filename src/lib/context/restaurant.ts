import type { Writable } from 'svelte/store';

export const RESTAURANT_CTX = Symbol.for('restaurant');

export type RestaurantContext = Writable<string | null>;
