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

  /* ------------------ Route Params ------------------ */
  $: restaurantId = page.params.restaurantId as string;
  $: orderId = page.params.orderId as string;

  /* ------------------ State ------------------ */
  let currentOrder: Order | null = null;
  let localOrders: Order[] = [];
  let loading = true;

  let lastKnownStatus: OrderStatus | null = null;
  let loadedOrderId: string | null = null;

  let channel: ReturnType<typeof supabase.channel> | null = null;

  /* ------------------ Helpers ------------------ */

  function getlocalOrderIds(): string[] {
    const key = `qsr_orders_${restaurantId}`;
    return JSON.parse(localStorage.getItem(key) ?? '[]');
  }

  async function loadCurrentOrder(id: string): Promise<void> {
    if (!id || id === loadedOrderId) return;

    loadedOrderId = id;

    const { data, error } = await supabase
      .from('orders')
      .select('id, token_number, status')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('Failed to load order:', error);
      currentOrder = null;
      return;
    }

    currentOrder = data as Order;
    lastKnownStatus = currentOrder.status;
  }

  async function loadlocalOrders(): Promise<void> {
    const ids = getlocalOrderIds();
    if (ids.length === 0) {
      localOrders = [];
      return;
    }

    const { data } = await supabase
      .from('orders')
      .select('id, token_number, status')
      .in('id', ids)
      .order('created_at', { ascending: false });

    localOrders = (data ?? []) as Order[];
  }

  function alertOrderReady(order: Order): void {
    alert(`🎉 Your order #${order.token_number} is ready!`);

    if (navigator.vibrate) {
      navigator.vibrate(300);
    }
  }

  function statusLabel(status: OrderStatus): string {
    switch (status) {
      case 'pending':
        return 'Order placed';
      case 'preparing':
        return 'Being prepared';
      case 'ready':
        return 'Ready for pickup';
    }
  }

  function statusClass(status: OrderStatus): string {
    switch (status) {
      case 'ready':
        return 'text-green-600';
      case 'preparing':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  }

  /* ------------------ Lifecycle ------------------ */

  onMount(async () => {
    await loadCurrentOrder(orderId);
    await loadlocalOrders();
    loading = false;

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
          await loadlocalOrders();

          const updated = localOrders.find(o => o.id === orderId);
          if (!updated) return;

          // 🔔 READY alert (fire once)
          if (
            lastKnownStatus &&
            lastKnownStatus !== 'ready' &&
            updated.status === 'ready'
          ) {
            alertOrderReady(updated);
          }

          lastKnownStatus = updated.status;
          currentOrder = updated;
        }
      )
      .subscribe();
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });

  /* ------------------ React to URL Change (SAFE) ------------------ */
  $: if (!loading && orderId && orderId !== loadedOrderId) {
    loadCurrentOrder(orderId);
  }

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
      <p class={`font-medium ${statusClass(currentOrder.status)}`}>
        {statusLabel(currentOrder.status)}
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

    <!-- local Orders -->
    {#if localOrders.length > 1}
      <div class="border-t pt-4">
        <h2 class="text-sm font-medium mb-3">
          Your Orders (This session orders)
        </h2>

        <ul class="space-y-2 text-sm">
          {#each localOrders as o (o.id)}
            <button
              class={`w-full flex justify-between px-3 py-2 border rounded-lg ${
                o.id === currentOrder.id ? 'bg-gray-100' : ''
              }`}
              on:click={() => viewOrder(o.id)}
            >
              <span>Token #{o.token_number}</span>
              <span>{statusLabel(o.status)}</span>
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
