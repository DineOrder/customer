<script lang="ts">
  import { onMount } from 'svelte';
  import { getContext } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { RESTAURANT_CTX } from '$lib/context/restaurant';

  const restaurantStore = getContext<any>(RESTAURANT_CTX);

  let restaurantId: string | null = null;

  /* ------------------ Date Filter ------------------ */
  let selectedDate = 'today'; // today | yesterday | custom
  let customDate = '';

  /* ------------------ Metrics ------------------ */
  let totalOrders = 0;
  let totalRevenue = 0;
  let dineInCount = 0;
  let takeawayCount = 0;

  let loading = true;

  restaurantStore.subscribe((v: string | null) => {
    restaurantId = v;
  });

  onMount(loadStats);

  $: selectedDate, customDate, restaurantId, loadStats();

  function getDateRange() {
    const now = new Date();
    let start: Date;
    let end: Date = new Date();

    if (selectedDate === 'today') {
      start = new Date();
      start.setHours(0, 0, 0, 0);
    } else if (selectedDate === 'yesterday') {
      start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date(customDate);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }

  async function loadStats() {
    if (!restaurantId) return;
    if (selectedDate === 'custom' && !customDate) return;

    loading = true;

    const { start, end } = getDateRange();

    const { data } = await supabase
      .from('orders')
      .select('order_type, total_amount, payment_status')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const orders = data ?? [];

    totalOrders = orders.length;
    dineInCount = orders.filter(o => o.order_type === 'dine_in').length;
    takeawayCount = orders.filter(o => o.order_type === 'takeaway').length;

    totalRevenue = orders
      .filter(o => o.payment_status === 'success')
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    loading = false;
  }
</script>

<!-- PAGE -->
<div class="space-y-6">

  <!-- HEADER -->
  <div>
    <h1 class="text-lg font-semibold text-slate-800">
      Dashboard
    </h1>
    <p class="text-sm text-slate-500">
      Quick overview of your restaurant
    </p>
  </div>

  <!-- DATE FILTER -->
  <div class="flex gap-2 items-center">
    <button
      class="px-3 py-1.5 rounded-lg text-sm
        {selectedDate === 'today'
          ? 'bg-slate-900 text-white'
          : 'bg-white border'}"
      on:click={() => selectedDate = 'today'}
    >
      Today
    </button>

    <button
      class="px-3 py-1.5 rounded-lg text-sm
        {selectedDate === 'yesterday'
          ? 'bg-slate-900 text-white'
          : 'bg-white border'}"
      on:click={() => selectedDate = 'yesterday'}
    >
      Yesterday
    </button>

    <button
      class="px-3 py-1.5 rounded-lg text-sm
        {selectedDate === 'custom'
          ? 'bg-slate-900 text-white'
          : 'bg-white border'}"
      on:click={() => selectedDate = 'custom'}
    >
      Custom
    </button>

    {#if selectedDate === 'custom'}
      <input
        type="date"
        class="ml-2 border rounded-lg px-2 py-1.5 text-sm"
        bind:value={customDate}
      />
    {/if}
  </div>

  <!-- METRICS -->
  {#if loading}
    <p class="text-sm text-slate-500">Loading stats…</p>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

      <!-- TOTAL ORDERS -->
      <div class="bg-white border rounded-xl p-4">
        <div class="text-xs text-slate-500 mb-1">Total Orders</div>
        <div class="text-2xl font-semibold">{totalOrders}</div>
      </div>

      <!-- REVENUE -->
      <div class="bg-white border rounded-xl p-4">
        <div class="text-xs text-slate-500 mb-1">Amount Received</div>
        <div class="text-2xl font-semibold">₹{totalRevenue}</div>
      </div>

      <!-- DINE IN -->
      <div class="bg-white border rounded-xl p-4">
        <div class="text-xs text-slate-500 mb-1">Dine-In</div>
        <div class="text-2xl font-semibold">{dineInCount}</div>
      </div>

      <!-- TAKEAWAY -->
      <div class="bg-white border rounded-xl p-4">
        <div class="text-xs text-slate-500 mb-1">Takeaway</div>
        <div class="text-2xl font-semibold">{takeawayCount}</div>
      </div>

    </div>
  {/if}
</div>
