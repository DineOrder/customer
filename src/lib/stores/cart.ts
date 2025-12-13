// src/lib/stores/cart.ts

import { writable } from 'svelte/store';
import type { CartItem, CartState } from '$lib/types/cart';

const STORAGE_KEY = 'qsr_cart';

/* ------------------ Helpers ------------------ */

function readFromSession(): CartState | null {
  if (typeof window === 'undefined') return null;

  const raw = sessionStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as CartState) : null;
}

function writeToSession(cart: CartState | null): void {
  if (typeof window === 'undefined') return;

  if (cart) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

function createEmptyCart(
  restaurantId: string,
  orderType: 'dine_in' | 'takeaway'
): CartState {
  return {
    restaurantId,
    orderType,
    items: []
  };
}

/* ------------------ Store ------------------ */

function createCartStore() {
  const { subscribe, set, update } = writable<CartState | null>(null);

  /**
   * Initialize cart
   * - Restore from sessionStorage if valid
   * - Otherwise create new
   */
  function initCart(
    restaurantId: string,
    orderType: 'dine_in' | 'takeaway'
  ): void {
    const existing = readFromSession();

    if (
      existing &&
      existing.restaurantId === restaurantId &&
      existing.orderType === orderType
    ) {
      set(existing);
      return;
    }

    const fresh = createEmptyCart(restaurantId, orderType);
    set(fresh);
    writeToSession(fresh);
  }

  function addItem(item: Omit<CartItem, 'quantity'>): void {
    update((cart) => {
      if (!cart) return cart;

      const existing = cart.items.find(
        (i) => i.itemId === item.itemId
      );

      if (existing) {
        existing.quantity += 1;
      } else {
        cart.items.push({ ...item, quantity: 1 });
      }

      writeToSession(cart);
      return cart;
    });
  }

  function updateQuantity(itemId: string, quantity: number): void {
    update((cart) => {
      if (!cart) return cart;

      cart.items = cart.items.filter((item) => {
        if (item.itemId === itemId) {
          item.quantity = quantity;
          return quantity > 0;
        }
        return true;
      });

      writeToSession(cart);
      return cart;
    });
  }

  function setMobileNumber(mobile: string): void {
    update((cart) => {
      if (!cart) return cart;

      cart.mobileNumber = mobile;
      writeToSession(cart);
      return cart;
    });
  }

  /**
   * Clear cart after successful checkout
   */
  function clearCart(): void {
    set(null);
    writeToSession(null);
  }

  return {
    subscribe,
    initCart,
    addItem,
    updateQuantity,
    setMobileNumber,
    clearCart
  };
}

export const cart = createCartStore();
