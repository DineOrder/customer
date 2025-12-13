<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { supabase } from '$lib/supabaseClient';

  /* ================= TYPES ================= */

  type OrderStatus = 'pending' | 'preparing' | 'ready';
  type OrderType = 'dine_in' | 'takeaway';

  type Order = {
    id: string;
    token: number;
    status: OrderStatus;
    type: OrderType;
    items: { quantity: number; name: string }[];
    flash?: boolean;
  };

  const STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready'];

  /* ================= STATE ================= */

  const restaurantId = page.params.restaurantId as string;

  let orders: Order[] = [];
  let loading = true;
  let filter: 'all' | OrderType = 'all';

  let isMobile = false;
  let activeStatus: OrderStatus = 'pending';

  let channel: ReturnType<typeof supabase.channel> | null = null;

  /* ================= REACTIVE DERIVED ARRAYS ================= */

  $: pendingOrders = orders.filter(
    (o) => o.status === 'pending' && (filter === 'all' || o.type === filter)
  );

  $: preparingOrders = orders.filter(
    (o) => o.status === 'preparing' && (filter === 'all' || o.type === filter)
  );

  $: readyOrders = orders.filter(
    (o) => o.status === 'ready' && (filter === 'all' || o.type === filter)
  );

  /* ================= HELPERS ================= */

  function updateViewport() {
    if (!browser) return;
    isMobile = window.innerWidth < 768;
  }

  /* ================= LOAD ================= */

  async function loadOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        token_number,
        status,
        order_type,
        order_items (
          quantity,
          menu_items ( name )
        )
      `)
      .eq('restaurant_id', restaurantId)
      .order('token_number');

    if (error) {
      console.error(error);
      return;
    }

    const raw = (data ?? []) as any[];

    orders = raw.map((o) => ({
      id: o.id,
      token: o.token_number,
      status: o.status,
      type: o.order_type,
      items: (o.order_items ?? []).map((i: any) => ({
        quantity: Number(i.quantity),
        name: i.menu_items?.name ?? 'Item'
      }))
    }));

    loading = false;
  }

  /* ================= MOVE ================= */

  async function move(order: Order, forceReady = false) {
    if (order.status === 'ready') return;

    let next: OrderStatus | null = null;

    if (order.status === 'pending') {
      next = forceReady ? 'ready' : 'preparing';
    } else if (order.status === 'preparing') {
      next = 'ready';
    }

    if (!next) return;

    // optimistic update
    orders = orders.map((o) =>
      o.id === order.id ? { ...o, status: next, flash: true } : o
    );

    if (isMobile) activeStatus = next;

    setTimeout(() => {
      orders = orders.map((o) =>
        o.id === order.id ? { ...o, flash: false } : o
      );
    }, 250);

    await supabase
      .from('orders')
      .update({ status: next })
      .eq('id', order.id);
  }

  /* ================= LONG PRESS (MOBILE) ================= */

  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressTriggered = false;

  function pressStart(order: Order) {
    if (order.status !== 'pending') return;
    longPressTriggered = false;
    pressTimer = setTimeout(() => {
      longPressTriggered = true;
      move(order, true);
    }, 700);
  }

  function pressEnd(order: Order) {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
    if (!longPressTriggered) move(order);
  }

  function pressCancel() {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  }

  /* ================= LIFECYCLE ================= */

  onMount(async () => {
    if (browser) {
      updateViewport();
      window.addEventListener('resize', updateViewport);
    }

    await loadOrders();

    channel = supabase
      .channel(`kitchen-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        loadOrders
      )
      .subscribe();
  });

  onDestroy(() => {
    if (browser) window.removeEventListener('resize', updateViewport);
    if (channel) supabase.removeChannel(channel);
  });
</script>

<!-- ================= UI ================= -->

<div class="min-h-screen p-4 bg-gray-50">

  <!-- FILTER -->
  <div class="flex gap-2 mb-4">
    <button class="flex-1 border py-2 rounded" on:click={() => (filter = 'all')}>ALL</button>
    <button class="flex-1 border py-2 rounded" on:click={() => (filter = 'dine_in')}>DINE-IN</button>
    <button class="flex-1 border py-2 rounded" on:click={() => (filter = 'takeaway')}>TAKEAWAY</button>
  </div>

  {#if loading}
    <p class="text-center">Loading…</p>

  {:else if isMobile}

    <!-- MOBILE -->
    <div class="flex gap-2 mb-3">
      {#each STATUSES as s}
        <button
          class="flex-1 border py-2 rounded {activeStatus === s ? 'bg-black text-white' : ''}"
          on:click={() => (activeStatus = s)}
        >
          {s.toUpperCase()}
        </button>
      {/each}
    </div>

    <div class="space-y-3">
      {#each (activeStatus === 'pending'
        ? pendingOrders
        : activeStatus === 'preparing'
        ? preparingOrders
        : readyOrders) as order (order.id)}

        <button
          class="bg-white border rounded p-3 cursor-pointer transition-transform
                 {order.flash ? 'scale-105 bg-green-50' : ''}"
          type="button"
          aria-label={`Order token ${order.token}`}
          on:pointerdown={() => pressStart(order)}
          on:pointerup={() => pressEnd(order)}
          on:pointercancel={pressCancel}
          on:click={() => move(order)}
        >
          <div class="text-2xl font-bold">TOKEN {order.token}</div>
          <div class="text-xs mb-2">{order.type.toUpperCase()}</div>
          {#each order.items as item}
            <div>{item.quantity} × {item.name}</div>
          {/each}
        </button>

      {/each}
    </div>

  {:else}

    <!-- DESKTOP / TABLET -->
    <div class="grid grid-cols-3 gap-4">

      <div>
        <h3 class="font-bold mb-2">NEW</h3>
        {#each pendingOrders as order (order.id)}
          <button class="bg-white border rounded p-3 w-full text-left"
                  on:click={() => move(order)}>
            <div class="text-2xl font-bold">TOKEN {order.token}</div>
            {#each order.items as item}
              <div>{item.quantity} × {item.name}</div>
            {/each}
          </button>
        {/each}
      </div>

      <div>
        <h3 class="font-bold mb-2">COOKING</h3>
        {#each preparingOrders as order (order.id)}
          <button class="bg-white border rounded p-3 w-full text-left"
                  on:click={() => move(order)}>
            <div class="text-2xl font-bold">TOKEN {order.token}</div>
            {#each order.items as item}
              <div>{item.quantity} × {item.name}</div>
            {/each}
          </button>
        {/each}
      </div>

      <div>
        <h3 class="font-bold mb-2">READY</h3>
        {#each readyOrders as order (order.id)}
          <div class="bg-green-50 border rounded p-3">
            <div class="text-2xl font-bold">TOKEN {order.token}</div>
          </div>
        {/each}
      </div>

    </div>

  {/if}
</div>
