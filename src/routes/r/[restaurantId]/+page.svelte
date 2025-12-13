<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { cart } from '$lib/stores/cart';
  import { menuStore, menuLoaded } from '$lib/stores/menu';
  import type { MenuItem } from '$lib/types/menu';

  export let data: {
    menu: MenuItem[];
  };

  $: restaurantId = page.params.restaurantId as string;

  onMount(() => {
    menuStore.set(data.menu);
    menuLoaded.set(true);
  });

  function selectOrderType(type: 'dine_in' | 'takeaway'): void {
    // 1️⃣ Initialize cart for this session
    cart.initCart(restaurantId, type);

    // 2️⃣ Navigate explicitly (never relative)
    goto(`/r/${restaurantId}/menu?type=${type}`);
  }
</script>


<!-- UI intentionally minimal -->
<div class="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
  <h1 class="text-xl font-semibold text-center">
    How would you like to order?
  </h1>

  <button
    class="w-full max-w-xs py-4 rounded-xl bg-black text-white text-lg font-medium active:scale-95"
    on:click={() => selectOrderType('dine_in')}
  >
    Dine In
  </button>

  <button
    class="w-full max-w-xs py-4 rounded-xl border text-lg font-medium active:scale-95"
    on:click={() => selectOrderType('takeaway')}
  >
    Takeaway
  </button>
</div>
