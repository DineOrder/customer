<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  import { supabase } from '$lib/supabaseClient';
  import { menuStore, menuLoaded } from '$lib/stores/menu';
  import { cart } from '$lib/stores/cart';

  import type { MenuItem } from '$lib/types/menu';
  import type { CartState } from '$lib/types/cart';

  type OrderType = 'dine_in' | 'takeaway';

  function parseOrderType(value: string | null): OrderType {
    return value === 'takeaway' ? 'takeaway' : 'dine_in';
  }

  /* ------------------ Route ------------------ */
  $: restaurantId = page.params.restaurantId as string;
  $: orderType = parseOrderType(page.url.searchParams.get('type'));

  /* ------------------ Stores ------------------ */
  $: menu = $menuStore as MenuItem[];
  $: cartState = $cart as CartState | null;

  /* ------------------ Totals ------------------ */
  $: totalItems =
    cartState?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  $: totalAmount =
    cartState?.items.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0
    ) ?? 0;

  /* ------------------ Load ------------------ */
  onMount(async () => {
    if (!$cart) {
      cart.initCart(restaurantId, orderType);
    }

    // if ($menuLoaded && menu.length > 0) return;

    const { data, error } = await supabase
      .from('public_menu_items')
      .select(`
        id,
        restaurant_id,
        name,
        price,
        description,
        tags,
        is_veg,
        image_url,
        category_name,
        available,
        sort_order
      `)
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Menu fetch failed:', error);
      return;
    }

    menuStore.set((data ?? []) as MenuItem[]);
    menuLoaded.set(true);
  });

  /* ------------------ Cart ------------------ */
  function addToCart(item: MenuItem) {
    cart.addItem({
      itemId: item.id,
      name: item.name,
      price: item.price
    });
  }

  function increase(itemId: string) {
    const item = cartState?.items.find((i) => i.itemId === itemId);
    if (item) cart.updateQuantity(itemId, item.quantity + 1);
  }

  function decrease(itemId: string) {
    const item = cartState?.items.find((i) => i.itemId === itemId);
    if (item) cart.updateQuantity(itemId, item.quantity - 1);
  }

  function goToCart() {
    goto(`/r/${restaurantId}/cart`);
  }
</script>

<!-- ================= PAGE ================= -->

<div class="min-h-screen px-4 py-6 pb-28">
  <h1 class="text-xl font-semibold mb-6">
    {orderType === 'dine_in' ? 'Dine In' : 'Takeaway'} Menu
  </h1>

  {#if !$menuLoaded}
    <p class="text-sm text-gray-500">Loading menu…</p>

  {:else if menu.length === 0}
    <p class="text-sm text-gray-500">No items available</p>

  {:else}
    <ul class="space-y-4">
      {#each menu as item (item.id)}
        <li class="flex gap-4 border rounded-lg p-4 bg-white">

          <!-- IMAGE -->
          {#if item.image_url}
            <img
              src={item.image_url}
              alt={item.name}
              class="w-20 h-20 rounded object-cover shrink-0"
            />
          {:else}
            <div
              class="w-20 h-20 rounded bg-gray-100 flex items-center justify-center
                     text-xs text-gray-400 shrink-0"
            >
              No image
            </div>
          {/if}

          <!-- DETAILS -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-medium truncate">{item.name}</p>

              <span
                class="text-xs px-2 py-0.5 rounded
                  {item.is_veg
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'}"
              >
                {item.is_veg ? 'Veg' : 'Non-veg'}
              </span>
            </div>

            <p class="text-sm text-gray-600">₹{item.price}</p>

            {#if item.description}
              <p class="text-xs text-gray-500 mt-1 line-clamp-2">
                {item.description}
              </p>
            {/if}

            {#if item.tags && item.tags.length > 0}
              <div class="flex flex-wrap gap-1 mt-2">
                {#each item.tags as tag}
                  <span class="text-xs bg-gray-100 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                {/each}
              </div>
            {/if}
          </div>

          <!-- ACTION -->
          <div class="flex items-center">
            {#if cartState?.items.find(i => i.itemId === item.id)}
              <div class="flex items-center gap-2">
                <button
                  class="w-8 h-8 border rounded"
                  on:click={() => decrease(item.id)}
                >
                  −
                </button>

                <span>
                  {cartState.items.find(i => i.itemId === item.id)?.quantity}
                </span>

                <button
                  class="w-8 h-8 bg-black text-white rounded"
                  on:click={() => increase(item.id)}
                >
                  +
                </button>
              </div>
            {:else}
              <button
                class="px-3 py-2 bg-black text-white rounded"
                on:click={() => addToCart(item)}
              >
                Add
              </button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<!-- ================= CART BAR ================= -->

<div
  class="fixed bottom-0 left-0 right-0 px-4 py-3 flex justify-between items-center
         {totalItems > 0 ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}"
>
  <div>
    {#if totalItems > 0}
      <p class="text-sm">
        {totalItems} item{totalItems > 1 ? 's' : ''}
      </p>
      <p class="font-medium">₹{totalAmount}</p>
    {:else}
      <p class="text-sm font-medium">Your cart is empty</p>
      <p class="text-xs">Add items to continue</p>
    {/if}
  </div>

  <button
    class="px-4 py-2 rounded-lg font-medium
      {totalItems > 0
        ? 'bg-white text-black'
        : 'bg-gray-300 text-gray-500 cursor-not-allowed'}"
    disabled={totalItems === 0}
    on:click={goToCart}
  >
    View Cart
  </button>
</div>
