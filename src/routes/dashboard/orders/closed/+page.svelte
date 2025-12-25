<script lang="ts">
  import { onMount } from 'svelte';
  import { getContext } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { RESTAURANT_CTX } from '$lib/context/restaurant';
const SIX_HOURS = 1 * 60 * 60 * 1000;

function isClosedOrder(order: ClosedOrder): boolean {
  if (order.status !== 'ready') return false;

  // Force UTC parsing
  const utc = order.created_at.endsWith('Z')
    ? order.created_at
    : `${order.created_at}Z`;

  const createdTime = new Date(utc).getTime();

  return Date.now() - createdTime > SIX_HOURS;
}


type ClosedOrder = {
  id: string;
  token_number: number;
  status: string;
  order_type: 'dine_in' | 'takeaway';
  created_at: string;
  payment_status: string | null;
  order_items: {
    quantity: number;
    menu_items: {
      name: string;
    }[]; // ✅ ARRAY
  }[];
};


  const restaurantStore = getContext<any>(RESTAURANT_CTX);

  let restaurantId: string | null = null;
  let orders: ClosedOrder[] = [];
  let loading = true;

  const CLOSED_STATUSES = ['ready'];

  onMount(async () => {
    restaurantStore.subscribe(async (id: string | null) => {
      if (!id) return;

      restaurantId = id;
      await loadClosedOrders();
    });
  });

  async function loadClosedOrders() {
    loading = true;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        token_number,
        status,
        order_type,
        created_at,
        payment_status,
        order_items (
          quantity,
          menu_items ( name )
        )
      `)
      .eq('restaurant_id', restaurantId)
      .in('status', CLOSED_STATUSES)
      .order('created_at', { ascending: false });

    if (!error) {
     orders = (data ?? []).filter(isClosedOrder);
    }

    loading = false;
  }

  function formatTime(iso: string): string {
    const utc = iso.includes('Z') ? iso : `${iso}Z`;
    const d = new Date(utc);

    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function statusBadge(status: string): string {
    switch (status) {
      case 'ready':
      case 'completed':
        return 'bg-emerald-100 text-emerald-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }
</script>

<!-- PAGE -->
<div class="max-w-4xl mx-auto space-y-6">

  <!-- HEADER -->
  <div>
    <h1 class="text-xl font-semibold text-slate-900">
      Closed Orders
    </h1>
    <p class="text-sm text-slate-500">
      Completed and cancelled orders (read-only)
    </p>
  </div>

  {#if loading}
    <div class="text-sm text-slate-500">
      Loading closed orders…
    </div>

  {:else if orders.length === 0}
    <!-- EMPTY STATE -->
    <div class="border rounded-xl bg-white p-8 text-center">
      <div class="text-3xl mb-2">📦</div>
      <div class="font-medium text-slate-700">
        No closed orders yet
      </div>
      <div class="text-sm text-slate-500 mt-1">
        Completed and cancelled orders will appear here
      </div>
    </div>

  {:else}
    <!-- ORDERS LIST -->
    <div class="space-y-4">
      {#each orders as order}
        <div class="bg-white border rounded-xl p-4">

          <!-- HEADER -->
          <div class="flex justify-between items-start mb-2">
            <div>
              <div class="text-xl font-bold">
                #{order.token_number}
              </div>
              <div class="text-xs text-slate-500 mt-1">
                {formatTime(order.created_at)}
              </div>
            </div>

            <div class="flex flex-col items-end gap-1">
              <span
                class={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(order.status)}`}
              >
                {order.status.toUpperCase()}
              </span>

              <span class="text-[11px] text-slate-500">
                {order.order_type === 'dine_in' ? 'DINE IN' : 'TAKEAWAY'}
              </span>
            </div>
          </div>

          <!-- ITEMS -->
          <div class="text-sm text-slate-700 space-y-0.5">
           {#each order.order_items as item}
  <div>
    {item.quantity} × {item.menu_items[0]?.name ?? 'Item'}
  </div>
{/each}

          </div>

          <!-- FOOTER -->
          <div class="mt-3 text-xs text-slate-500">
            Payment: {order.payment_status ?? '—'}
          </div>

        </div>
      {/each}
    </div>
  {/if}
</div>
