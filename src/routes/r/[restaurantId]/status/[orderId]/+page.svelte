<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { supabase } from '$lib/supabaseClient';

  /* ------------------ Types ------------------ */
  type OrderStatus = 'pending' | 'preparing' | 'ready';

  type Order = {
    id: string;
    token_number: number;
    status: OrderStatus;
  };

  /* ------------------ Route Context ------------------ */
  $: restaurantId = page.params.restaurantId as string;
  $: orderId = page.params.orderId as string;

  /* ------------------ State ------------------ */
  let currentOrder: Order | null = null;
  let sessionOrders: Order[] = [];
  let loading = true;

  let channel: ReturnType<typeof supabase.channel> | null = null;

  /* ------------------ Helpers ------------------ */
  function getSessionOrderIds(): string[] {
    const key = `qsr_orders_${restaurantId}`;
    return JSON.parse(sessionStorage.getItem(key) ?? '[]');
  }

  async function loadSessionOrders(): Promise<void> {
    const ids = getSessionOrderIds();
    if (ids.length === 0) {
      sessionOrders = [];
      return;
    }

    const { data } = await supabase
      .from('orders')
      .select('id, token_number, status')
      .in('id', ids)
      .order('created_at', { ascending: false });

    sessionOrders = (data ?? []) as Order[];
  }

  /* ------------------ Lifecycle ------------------ */
  onMount(async () => {
    /* 1️⃣ Load current order */
    const { data } = await supabase
      .from('orders')
      .select('id, token_number, status')
      .eq('id', orderId)
      .single();

    currentOrder = data as Order;
    loading = false;

    /* 2️⃣ Load ALL orders for this session */
    await loadSessionOrders();

    /* 3️⃣ Realtime: listen for inserts + updates */
    channel = supabase
      .channel(`orders-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        async () => {
          await loadSessionOrders();

          const updatedCurrent = sessionOrders.find(
            (o) => o.id === orderId
          );
          if (updatedCurrent) {
            currentOrder = updatedCurrent;
          }
        }
      )
      .subscribe();
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });

  /* ------------------ Actions ------------------ */
  function orderMore(): void {
    goto(`/r/${restaurantId}/menu`);
  }

  function viewOrder(id: string): void {
    goto(`/r/${restaurantId}/status/${id}`);
  }
</script>

<!-- ------------------ UI ------------------ -->
<div class="min-h-screen px-4 py-6 text-center">
  {#if loading}
    <p class="text-gray-500">Loading order status…</p>
  {:else if currentOrder}
    <!-- Current Order -->
    <div class="mb-8">
      <p class="text-sm text-gray-500">Current Order Token</p>
      <h1 class="text-4xl font-bold mb-2">
        #{currentOrder.token_number}
      </h1>
      <p class="font-medium capitalize">
        {currentOrder.status}
      </p>
    </div>

    <!-- Actions -->
    <div class="flex justify-center mb-8">
      <button
        class="px-5 py-2 rounded-lg bg-black text-white"
        on:click={orderMore}
      >
        Order More
      </button>
    </div>

    <!-- All Orders in Session -->
    {#if sessionOrders.length > 1}
      <div class="border-t pt-4">
        <h2 class="text-sm font-medium mb-3">
          Your Orders (This Session)
        </h2>

        <ul class="space-y-2 text-sm">
          {#each sessionOrders as o (o.id)}
            <button
              class="w-full flex justify-between px-3 py-2 border rounded-lg
                {o.id === currentOrder.id ? 'bg-gray-100' : ''}"
              on:click={() => viewOrder(o.id)}
            >
              <span>Token #{o.token_number}</span>
              <span class="capitalize">{o.status}</span>
            </button>
          {/each}
        </ul>
      </div>
    {/if}

    <p class="text-xs text-gray-400 mt-6">
      Status updates automatically
    </p>
  {:else}
    <p class="text-red-500">Unable to load order</p>
  {/if}
</div>
