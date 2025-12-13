// src/lib/types/cart.ts

import type { MenuItem } from './menu';

/**
 * Single item inside cart
 */
export type CartItem = {
  itemId: MenuItem['id'];
  name: MenuItem['name'];
  price: MenuItem['price'];
  quantity: number;
};

/**
 * Cart scoped to a restaurant + order type
 */
export type CartState = {
  restaurantId: string;
  orderType: 'dine_in' | 'takeaway';

  items: CartItem[];

  /**
   * Only required for takeaway
   */
  mobileNumber?: string;
};
