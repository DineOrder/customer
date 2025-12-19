<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  import { cart } from '$lib/stores/cart';
  import type { CartItem } from '$lib/types/cart';

  /**
   * Restaurant context
   */
  $: restaurantId = page.params.restaurantId as string;

  /**
   * Current cart snapshot
   */
  $: cartState = $cart;

  /**
   * Safety: if cart is not initialized or empty, go back to menu
   */
  $: if (!cartState || cartState.items.length === 0) {
    // avoid infinite redirect during SSR
    if (typeof window !== 'undefined') {
      goto(`/r/${restaurantId}/menu?type=${cartState?.orderType ?? 'dine_in'}`);
    }
  }

  /**
   * Increase quantity
   */
  function increase(item: CartItem): void {
    cart.updateQuantity(item.itemId, item.quantity + 1);
  }

  /**
   * Decrease quantity
   */
  function decrease(item: CartItem): void {
    cart.updateQuantity(item.itemId, item.quantity - 1);
  }

  /**
   * Calculate total
   */
  $: total =
    cartState?.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    ) ?? 0;

function backToMenu(): void {
  if (!cartState?.orderType) return;

  goto(`/r/${restaurantId}/menu?type=${cartState.orderType}`);
}



  /**
   * Proceed to checkout
   */
  function proceed(): void {
    goto(`/r/${restaurantId}/checkout`);
  }
</script>

<div class="min-h-screen px-4 py-6">
<div class="flex items-center justify-between mb-6">
  <h1 class="text-xl font-semibold">Your Cart</h1>

  <button
    type="button"
    class="text-sm text-gray-600 underline"
    on:click={backToMenu}
  >
    Back to Menu
  </button>
</div>



  {#if cartState && cartState.items.length > 0}
    <ul class="space-y-4 mb-6">
      {#each cartState.items as item (item.itemId)}
        <li class="flex items-center justify-between border rounded-lg p-4">
          <div>
            <p class="font-medium">{item.name}</p>
            <p class="text-sm text-gray-600">
              ₹{item.price} × {item.quantity}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <button
              class="w-8 h-8 rounded-full border text-lg"
              on:click={() => decrease(item)}
            >
              −
            </button>

            <span class="min-w-[20px] text-center">
              {item.quantity}
            </span>

            <button
              class="w-8 h-8 rounded-full bg-black text-white text-lg"
              on:click={() => increase(item)}
            >
              +
            </button>
          </div>
        </li>
      {/each}
    </ul>

    <!-- Total -->
    <div class="flex items-center justify-between mb-6">
      <span class="text-lg font-medium">Total</span>
      <span class="text-lg font-semibold">₹{total}</span>
    </div>

    <!-- Proceed -->
    <button
      class="w-full py-4 rounded-xl bg-black text-white text-lg font-medium active:scale-95"
      on:click={proceed}
    >
      Proceed to Checkout
    </button>
  {/if}
</div>
