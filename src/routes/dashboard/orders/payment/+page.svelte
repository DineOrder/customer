<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getContext } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { RESTAURANT_CTX } from '$lib/context/restaurant';

  /* ------------------ Types ------------------ */
  type OrderItem = {
    quantity: number;
    menu_items: {
      name: string;
    }[];
  };

  type Order = {
    id: string;
    token_number: number | null;
    order_type: 'dine_in' | 'takeaway';
    status: string;
    payment_status: 'pending' | 'failed' | 'cancelled';
    payment_mode: 'counter' | 'online';
    created_at: string;
    order_items: OrderItem[];
  };

  /* ------------------ Context ------------------ */
  const restaurantStore = getContext<any>(RESTAURANT_CTX);

  let restaurantId: string | null = null;
  let orders: Order[] = [];
  let loading = true;
  let busyOrderId: string | null = null;

  let channel: ReturnType<typeof supabase.channel> | null = null;

  /* ------------------ Subscribe to restaurant context ------------------ */
  const unsubscribe = restaurantStore.subscribe((v: string | null) => {
    restaurantId = v;
  });

  /* ------------------ Load Orders ------------------ */
  async function loadOrders() {
    if (!restaurantId) return;

    loading = true;

    const { data } = await supabase
      .from('orders')
      .select(`
        id,
        token_number,
        order_type,
        status,
        payment_status,
        payment_mode,
        created_at,
        order_items (
          quantity,
          menu_items ( name )
        )
      `)
      .eq('restaurant_id', restaurantId)
      .neq('payment_status', 'success')
      .order('created_at', { ascending: false });

    orders = data ?? [];
    loading = false;
  }

  /* ------------------ Accept Payment ------------------ */
  async function acceptPayment(order: Order) {
    if (!confirm(`Confirm payment received for Token #${order.token_number ?? '—'}?`)) {
      return;
    }

    busyOrderId = order.id;

    await supabase
      .from('orders')
      .update({ payment_status: 'success' })
      .eq('id', order.id);

    busyOrderId = null;
    // Realtime will auto-refresh, but keep this as fallback
    await loadOrders();
  }

  /* ------------------ UI Helpers ------------------ */
  function paymentBadge(order: Order) {
    if (order.payment_status === 'failed') return 'bg-red-100 text-red-700';
    if (order.payment_status === 'cancelled') return 'bg-slate-200 text-slate-700';
    return 'bg-amber-100 text-amber-700';
  }

  function paymentText(order: Order) {
    if (order.payment_status === 'failed') return 'Payment Failed';
    if (order.payment_status === 'cancelled') return 'Payment Cancelled';
    return order.payment_mode === 'counter'
      ? 'Pay at Counter'
      : 'Payment Pending';
  }

  /* ------------------ Lifecycle ------------------ */
  onMount(async () => {
    await loadOrders();

    if (!restaurantId) return;

    // 🔴 REALTIME SUBSCRIPTION (NEW)
    channel = supabase
      .channel(`payment-pending-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        async () => {
          // Any insert/update affecting payments
          await loadOrders();
        }
      )
      .subscribe();
  });

  onDestroy(() => {
    unsubscribe();
    if (channel) {
      supabase.removeChannel(channel);
    }
  });
</script>

<!-- ================= UI (UNCHANGED) ================= -->
<div class="space-y-4">
  <div>
    <h1 class="text-lg font-semibold text-slate-800">
      Payment Pending Orders
    </h1>
    <p class="text-sm text-slate-500">
      These orders cannot proceed until payment is confirmed.
    </p>
  </div>

  {#if loading}
    <p class="text-sm text-slate-500">Loading orders…</p>
  {:else if orders.length === 0}
    <div class="border rounded-xl p-6 bg-white text-center text-slate-500">
      No payment pending orders 🎉
    </div>
  {:else}
    <div class="space-y-4">
      {#each orders as order (order.id)}
        <div class="bg-white border rounded-xl p-4">
          <div class="flex justify-between items-start mb-3">
            <div>
              <div class="text-2xl font-bold">
                #{order.token_number ?? '—'}
              </div>
              <div class="text-xs text-slate-500">
                {new Date(order.created_at).toLocaleString()}
              </div>
            </div>

            <span class={`px-2 py-1 rounded text-xs font-semibold ${paymentBadge(order)}`}>
              {paymentText(order)}
            </span>
          </div>

          <div class="text-sm text-slate-700 space-y-1 mb-4">
            {#each order.order_items as i}
              <div>{i.quantity} × {i.menu_items[0]?.name ?? 'Item'}</div>
            {/each}
          </div>

          <button
            class="w-full rounded-lg py-2 text-sm font-medium
                   bg-slate-900 text-white
                   disabled:opacity-50"
            disabled={busyOrderId === order.id}
            on:click={() => acceptPayment(order)}
          >
            {busyOrderId === order.id ? 'Updating…' : 'Accept Payment'}
          </button>

          <p class="mt-2 text-[11px] text-slate-400 text-center">
            Order will move to Active Orders after payment confirmation
          </p>
        </div>
      {/each}
    </div>
  {/if}
</div>
