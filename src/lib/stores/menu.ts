// src/lib/stores/menu.ts

import { writable } from 'svelte/store';
import type { MenuItem } from '$lib/types/menu';

/**
 * Holds the full menu for a restaurant
 * Preloaded on QR scan
 */
export const menuStore = writable<MenuItem[]>([]);

/**
 * Indicates whether menu has been loaded at least once
 * Used to avoid flickers / spinners
 */
export const menuLoaded = writable<boolean>(false);
