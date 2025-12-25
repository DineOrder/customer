<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  export let order: any;
  export let onMove: (order: any) => void;
  export let onUndo: (order: any) => void;

  let localTime: string | null = null;

  function utcToLocal(iso: string): string {
    // 🔒 FORCE UTC INTERPRETATION
    const utcDate = iso.endsWith('Z')
      ? new Date(iso)
      : new Date(iso + 'Z');

    return utcDate.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // ✅ CLIENT ONLY
  onMount(() => {
    if (browser && order?.createdAt) {
      localTime = utcToLocal(order.createdAt);
    }
  });
</script>

<div class="bg-white border rounded-xl p-4 transition-all duration-200">
  <!-- HEADER -->
  <div class="flex justify-between items-start mb-2">
    <div>
      <div class="text-2xl font-bold leading-none">
        #{order.token}
      </div>

      <!-- TIME (CLIENT ONLY) -->
      <div class="text-[11px] text-slate-500 mt-1">
        {#if localTime}
          {localTime}
        {:else}
          —
        {/if}
      </div>
    </div>

    <span
      class="
        text-[11px] font-semibold px-2 py-1 rounded-full
        {order.type === 'dine_in'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-emerald-100 text-emerald-700'}
      "
    >
      {order.type === 'dine_in' ? 'DINE IN' : 'TAKEAWAY'}
    </span>
  </div>

  <!-- ITEMS -->
  <div class="text-sm text-slate-700 mb-3 space-y-0.5">
    {#each order.items as i}
      <div>{i.quantity} × {i.name}</div>
    {/each}
  </div>

  <!-- STATUS -->
  {#if order.status === 'preparing'}
    <div class="text-[11px] text-amber-600 font-medium mb-2">
      Cooking…
    </div>
  {/if}

  <!-- ACTION -->
  {#if order.status !== 'ready'}
    <button
      disabled={order.busy}
      class="
        w-full rounded-lg py-2
        text-sm font-medium
        bg-slate-900 text-white
        disabled:opacity-50
      "
      on:click={() => onMove(order)}
    >
      {order.status === 'pending' ? 'Start Cooking' : 'Mark Ready'}
    </button>
  {/if}

  <!-- UNDO -->
  {#if order.undoUntil && Date.now() < order.undoUntil}
    <button
      class="
        mt-3 w-full rounded-lg border py-2
        text-xs font-medium text-slate-600
      "
      on:click={() => onUndo(order)}
    >
      Undo last action
    </button>
  {/if}
</div>
