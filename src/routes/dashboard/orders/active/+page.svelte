<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { getContext } from 'svelte';
  import { RESTAURANT_CTX } from '$lib/context/restaurant';
  import OrderCard from '$lib/components/OrderCard.svelte';

  /* ---------------- CONFIG ---------------- */
  const READY_AUTO_REMOVE_MINUTES = 10;
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const UNDO_WINDOW_MS = 30_000;

  /* ---------------- TYPES ---------------- */
  type OrderStatus = 'pending' | 'preparing' | 'ready';
  type OrderType = 'dine_in' | 'takeaway';

  type Order = {
    id: string;
    token: number;
    status: OrderStatus;
    type: OrderType;
    items: { quantity: number; name: string }[];
    createdAt: string;

    // UI-only
    busy?: boolean;
    flash?: boolean;
    previousStatus?: OrderStatus | null;
    undoUntil?: number | null;
    readyAt?: number | null;
  };

  /* ---------------- CONTEXT ---------------- */
  const restaurantStore = getContext<any>(RESTAURANT_CTX);
  if (!restaurantStore) {
    throw new Error('Restaurant context not found');
  }

  let restaurantId: string | null = null;
  restaurantStore.subscribe((id: string | null) => {
    restaurantId = id;
  });

  /* ---------------- STATE ---------------- */
  let orders: Order[] = [];
  let loading = true;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  // 🔐 UI state survives realtime refresh
  const uiState = new Map<
    string,
    {
      previousStatus?: OrderStatus;
      undoUntil?: number;
      readyAt?: number;
    }
  >();

  /* ---------------- HELPERS ---------------- */
function withinLast6Hours(createdAt: string): boolean {
  const createdUtc = createdAt.endsWith('Z')
    ? createdAt
    : `${createdAt}Z`; // 👈 FORCE UTC

  return Date.now() - new Date(createdUtc).getTime() < SIX_HOURS;
}


  function shouldShowReady(order: Order): boolean {
    if (order.status !== 'ready') return true;
    if (!order.readyAt) return true;

    return (
      Date.now() - order.readyAt <
      READY_AUTO_REMOVE_MINUTES * 60 * 1000
    );
  }

  /* ---------------- DERIVED ---------------- */
  $: visibleOrders = orders
    .filter(o => withinLast6Hours(o.createdAt))
    .filter(o => shouldShowReady(o));
$: pendingOrders   = visibleOrders.filter(o => o.status === 'pending');
$: preparingOrders = visibleOrders.filter(o => o.status === 'preparing');
$: readyOrders     = visibleOrders.filter(o => o.status === 'ready');


  /* ---------------- LOAD ---------------- */
  async function loadOrders() {
    if (!restaurantId) return;

    const { data } = await supabase
      .from('orders')
      .select(`
        id,
        token_number,
        status,
        order_type,
        created_at,
        order_items (
          quantity,
          menu_items ( name )
        )
      `)
      .eq('restaurant_id', restaurantId)
      .eq('payment_status', 'success') 
      .order('created_at', { ascending: true });

    orders =
      data?.map((o: any) => {
        const state = uiState.get(o.id);

        return {
  id: o.id,
  token: o.token_number,
  status: o.status as OrderStatus, // ✅ DB is source of truth
  type: o.order_type,
  createdAt: o.created_at,
  items: o.order_items.map((i: any) => ({
    quantity: Number(i.quantity),
    name: i.menu_items?.name ?? 'Item'
  })),

  // UI-only fields (DO NOT affect status)
  previousStatus: state?.previousStatus ?? null,
  undoUntil: state?.undoUntil ?? null,
  readyAt: state?.readyAt ?? null,
  busy: false,
  flash: false
};

      }) ?? [];

    loading = false;
  }

  /* ---------------- ACTIONS ---------------- */
  async function move(order: Order) {
    if (order.busy || order.status === 'ready') return;

    const next: OrderStatus =
      order.status === 'pending' ? 'preparing' : 'ready';

    const undoUntil = Date.now() + UNDO_WINDOW_MS;

    // persist UI intent
    uiState.set(order.id, {
      previousStatus: order.status,
      undoUntil,
      readyAt: next === 'ready' ? Date.now() : undefined
    });

    orders = orders.map(o =>
      o.id === order.id
        ? {
            ...o,
            status: next,
            busy: true,
            flash: true,
            previousStatus: order.status,
            undoUntil,
            readyAt: next === 'ready' ? Date.now() : null
          }
        : o
    );

    setTimeout(() => {
      orders = orders.map(o =>
        o.id === order.id ? { ...o, flash: false } : o
      );
    }, 150);

    await supabase
      .from('orders')
      .update({ status: next })
      .eq('id', order.id);

    orders = orders.map(o =>
      o.id === order.id ? { ...o, busy: false } : o
    );
  }

  async function undo(order: Order) {
    const state = uiState.get(order.id);
if (!state || !state.previousStatus) return;

const revertStatus: OrderStatus = state.previousStatus;

orders = orders.map(o =>
  o.id === order.id
    ? {
        ...o,
        status: revertStatus,
        previousStatus: null,
        undoUntil: null,
        readyAt: null
      }
    : o
);


    await supabase
      .from('orders')
      .update({ status: state.previousStatus })
      .eq('id', order.id);
  }

  /* ---------------- LIFECYCLE ---------------- */
  onMount(async () => {
    await loadOrders();

    channel = supabase
      .channel(`kds-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        loadOrders
      )
      .subscribe();
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });
</script>

<!-- ---------------- UI ---------------- -->
<div class="min-h-screen bg-slate-50 p-4">
  {#if loading}
    <p class="text-center text-sm text-slate-500">
      Loading orders…
    </p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

      <!-- NEW -->
      <section>
        <h3 class="mb-3 text-xs font-semibold flex items-center gap-2">
          NEW
          {#if pendingOrders.length > 0}
            <span class="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
          {/if}
        </h3>

        {#if pendingOrders.length === 0}
          <p class="text-sm text-slate-400 italic">
            No new orders
          </p>
        {:else}
          <div class="space-y-3">
            {#each pendingOrders as order (order.id)}
              <OrderCard {order} onMove={move} onUndo={undo} />
            {/each}
          </div>
        {/if}
      </section>

      <!-- COOKING -->
      <section>
        <h3 class="mb-3 text-xs font-semibold flex items-center gap-2">
          COOKING
          {#if preparingOrders.length > 0}
            <span class="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
          {/if}
        </h3>

        {#if preparingOrders.length === 0}
          <p class="text-sm text-slate-400 italic">
            Nothing cooking
          </p>
        {:else}
          <div class="space-y-3">
            {#each preparingOrders as order (order.id)}
              <OrderCard {order} onMove={move} onUndo={undo} />
            {/each}
          </div>
        {/if}
      </section>

      <!-- READY -->
      <section>
        <h3 class="mb-3 text-xs font-semibold flex items-center gap-2">
          READY
          {#if readyOrders.length > 0}
            <span class="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          {/if}
        </h3>

        {#if readyOrders.length === 0}
          <p class="text-sm text-slate-400 italic">
            No orders ready
          </p>
        {:else}
          <div class="space-y-3">
            {#each readyOrders as order (order.id)}
              <OrderCard {order} onMove={move} onUndo={undo} />
            {/each}
          </div>
        {/if}
      </section>

    </div>
  {/if}
</div>

