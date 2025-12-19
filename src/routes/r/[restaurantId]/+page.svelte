<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { cart } from '$lib/stores/cart';

  $: restaurantId = page.params.restaurantId as string;

  function selectOrderType(type: 'dine_in' | 'takeaway') {
    cart.initCart(restaurantId, type);
    goto(`/r/${restaurantId}/menu?type=${type}`);
  }
</script>

<div class="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
  <h1 class="text-xl font-semibold text-center">
    How would you like to order?
  </h1>

  <button
    class="w-full max-w-xs py-4 rounded-xl bg-black text-white text-lg font-medium"
    on:click={() => selectOrderType('dine_in')}
  >
    Dine In
  </button>

  <button
    class="w-full max-w-xs py-4 rounded-xl border text-lg font-medium"
    on:click={() => selectOrderType('takeaway')}
  >
    Takeaway
  </button>
</div>
