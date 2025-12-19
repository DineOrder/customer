<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabaseClient';
  import html2canvas from 'html2canvas';

  /* ================= TYPES ================= */

  type OrderStatus = 'pending' | 'preparing' | 'ready';

  type OrderItem = {
    quantity: number;
    price_per_item: number;
    menu_items: {
      name: string;
    } | null;
  };

  type Order = {
    id: string;
    token_number: number;
    status: OrderStatus;
    order_type: 'dine_in' | 'takeaway';
    total_amount: number;
    created_at: string;
    order_items: OrderItem[];
  };

  type Restaurant = {
    name: string;
  };

  /* ================= ROUTE ================= */

  $: restaurantId = $page.params.restaurantId as string;

  /* ================= STATE ================= */

  let orders: Order[] = [];
  let restaurant: Restaurant | null = null;
  let loading = true;

  let statusFilter: 'all' | OrderStatus = 'all';

  let channel: ReturnType<typeof supabase.channel> | null = null;
let showDownloadConfirm = false;
let selectedOrder: Order | null = null;

  /* ================= HELPERS ================= */

  function statusLabel(s: OrderStatus) {
    return s === 'pending'
      ? 'Order Placed'
      : s === 'preparing'
      ? 'Preparing'
      : 'Ready';
  }

  function statusBadgeClass(s: OrderStatus) {
    return s === 'ready'
      ? 'bg-green-100 text-green-700'
      : s === 'preparing'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-blue-100 text-blue-700';
  }

  function getSessionOrderIds(): string[] {
    return JSON.parse(
      localStorage.getItem(`qsr_orders_${restaurantId}`) ?? '[]'
    );
  }

  /* ================= NORMALIZER ================= */

  function normalizeOrders(raw: unknown[]): Order[] {
    return raw.map((o: any) => ({
      id: String(o.id),
      token_number: Number(o.token_number),
      status: o.status,
      order_type: o.order_type,
      total_amount: Number(o.total_amount),
      created_at: o.created_at,
      order_items: (o.order_items ?? []).map((i: any) => ({
        quantity: Number(i.quantity),
        price_per_item: Number(i.price_per_item),
        menu_items: i.menu_items
          ? { name: String(i.menu_items.name) }
          : null
      }))
    }));
  }

  /* ================= LOADERS ================= */

  async function loadOrders(): Promise<void> {
    const ids = getSessionOrderIds();
    if (ids.length === 0) {
      orders = [];
      return;
    }

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        token_number,
        status,
        order_type,
        total_amount,
        created_at,
        order_items (
          quantity,
          price_per_item,
          menu_items ( name )
        )
      `)
      .in('id', ids)
      .order('created_at', { ascending: false });

    if (!error && data) {
      orders = normalizeOrders(data);
    }
  }

  async function loadRestaurant(): Promise<void> {
    const { data } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .single();

    restaurant = data as Restaurant;
  }

  /* ================= DERIVED ================= */

  $: filteredOrders =
    statusFilter === 'all'
      ? orders
      : orders.filter(o => o.status === statusFilter);

  /* ================= DOWNLOAD ================= */

  // async function downloadBill(orderId: string): Promise<void> {
  //   const el = document.getElementById(`bill-${orderId}`);
  //   if (!el) return;

  //   const canvas = await html2canvas(el, {
  //     backgroundColor: '#ffffff',
  //     scale: 2
  //   });

  //   const link = document.createElement('a');
  //   link.download = `order_${orderId}.jpg`;
  //   link.href = canvas.toDataURL('image/jpeg', 0.95);
  //   link.click();
  // }

  function requestDownload(order: Order) {
  selectedOrder = order;
  showDownloadConfirm = true;
}

async function confirmDownload() {
  if (!selectedOrder) return;

  const el = document.getElementById(`print-${selectedOrder.id}`);
  if (!el) return;

  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2
  });

  const link = document.createElement('a');
  link.download = `token_${selectedOrder.token_number}.jpg`;
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();

  showDownloadConfirm = false;
  selectedOrder = null;
}


  /* ================= LIFECYCLE ================= */

  onMount(async () => {
    await loadRestaurant();
    await loadOrders();
    loading = false;

    channel = supabase
      .channel(`orders-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async () => {
          await loadOrders();
        }
      )
      .subscribe();
  });

  function orderMore() {
  goto(`/r/${restaurantId}/menu`);
}


  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });
</script>

<!-- ================= UI ================= -->

<div class="min-h-screen bg-neutral-100 px-4 py-6">
  {#if loading}
    <p class="text-center text-gray-500">Loading orders…</p>
  {:else}
<!-- STICKY HEADER -->
<div class="sticky top-0 z-20 bg-white border-b px-4 py-3 mb-6">
  <div class="max-w-md mx-auto flex items-center justify-between">
    <!-- LEFT -->
    <div class="text-left">
      <p class="text-xs text-gray-500 leading-none">
        {restaurant?.name}
      </p>
      <h1 class="text-base font-semibold leading-tight">
        Your Orders
      </h1>
    </div>

    <!-- CTA -->
    <button
      type="button"
      class="
        px-4 py-2 rounded-lg text-sm font-medium
        bg-black text-white
        shadow-sm
        hover:bg-gray-900
        active:scale-[0.98]
        transition
      "
      on:click={orderMore}
    >
      + Order More
    </button>
  </div>
</div>


<!-- FILTER -->
<div class="flex flex-wrap justify-center gap-3 mb-6">
  {#each ['all', 'pending', 'preparing', 'ready'] as f}
    <button
      type="button"
      class="
        px-4 py-2 rounded-lg text-sm font-medium transition
        border
        {statusFilter === f
          ? 'bg-black text-white border-black'
          : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'}
      "
      on:click={() => (statusFilter = f as any)}
    >
      {f === 'all' ? 'All Orders' : statusLabel(f as OrderStatus)}
    </button>
  {/each}
</div>



    <!-- BILLS LIST -->
    {#if filteredOrders.length > 0}
      <div class="space-y-4 max-w-md mx-auto">
        {#each filteredOrders as order (order.id)}
          <div
            id={`bill-${order.id}`}
            class="bg-white border border-gray-200 rounded-lg p-4"
            on:click={() => requestDownload(order)}
          >
            <!-- TOP ROW -->
            <div class="flex items-center justify-between mb-3">
              <div>
                <p class="text-xl font-semibold leading-none">
                  #{order.token_number}
                </p>
                <p class="text-xs text-gray-500 mt-1">
                  {order.order_type === 'dine_in' ? 'Dine In' : 'Takeaway'}
                </p>
              </div>

              <span
                class={`px-2 py-0.5 rounded text-xs font-medium
                  ${statusBadgeClass(order.status)}`}
              >
                {statusLabel(order.status)}
              </span>
            </div>

            <!-- ITEMS -->
            <div class="divide-y text-sm">
              {#each order.order_items as item}
                <div class="flex justify-between py-2">
                  <span class="text-gray-800">
                    {item.menu_items?.name ?? 'Item'} × {item.quantity}
                  </span>
                  <span class="text-gray-900 tabular-nums">
                    ₹{item.quantity * item.price_per_item}
                  </span>
                </div>
              {/each}
            </div>

            <!-- TOTAL -->
            <div class="flex justify-between items-center pt-3 mt-2 border-t">
              <span class="text-sm font-medium text-gray-700">
                Total
              </span>
              <span class="text-base font-semibold tabular-nums">
                ₹{order.total_amount}
              </span>
            </div>

            <p class="mt-2 text-[11px] text-gray-400 text-center">
              Tap card to download bill
            </p>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-center text-gray-500 mt-8">
        No orders match this filter
      </p>
    {/if}
  {/if}
</div>
{#if selectedOrder}
  <div class="fixed left-[-9999px] top-0">
    <div
      id={`print-${selectedOrder.id}`}
      class="w-[360px] bg-white p-4 text-sm text-black"
    >
      <!-- RESTAURANT -->
      <div class="text-center mb-3">
        <p class="font-semibold">{restaurant?.name}</p>
        <p class="text-xs text-gray-600">Order Receipt</p>
      </div>

      <!-- TOKEN -->
      <div class="text-center mb-4">
        <p class="text-2xl font-bold">
          Token #{selectedOrder.token_number}
        </p>
        <p class="text-xs uppercase">
          {selectedOrder.order_type === 'dine_in'
            ? 'Dine In'
            : 'Takeaway'}
        </p>
      </div>

      <!-- ITEMS -->
      <div class="border-t border-b divide-y">
        {#each selectedOrder.order_items as item}
          <div class="flex justify-between py-2">
            <span>
              {item.menu_items?.name ?? 'Item'} × {item.quantity}
            </span>
            <span>
              ₹{item.quantity * item.price_per_item}
            </span>
          </div>
        {/each}
      </div>

      <!-- TOTAL -->
      <div class="flex justify-between font-semibold pt-3">
        <span>Total</span>
        <span>₹{selectedOrder.total_amount}</span>
      </div>

      <!-- NOTE -->
      <p class="text-xs text-center text-gray-500 mt-4">
        Please collect your order when your token is called.
      </p>
    </div>
  </div>
{/if}
{#if showDownloadConfirm}
  <div class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
    <div class="bg-white rounded-lg p-4 w-72">
      <p class="font-medium mb-3 text-center">
        Download bill for Token #{selectedOrder?.token_number}?
      </p>

      <div class="flex gap-3 justify-end">
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md border"
          on:click={() => {
            showDownloadConfirm = false;
            selectedOrder = null;
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md bg-black text-white"
          on:click={confirmDownload}
        >
          Download
        </button>
      </div>
    </div>
  </div>
{/if}


