<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { writable } from "svelte/store";
  import { setContext } from "svelte";
  import { supabase } from "$lib/supabaseClient";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { RESTAURANT_CTX } from "$lib/context/restaurant";
  import { browser } from "$app/environment";
import {
  paymentPendingCount,
  paymentPulse,
  triggerPaymentPulse
} from '$lib/stores/paymentPending';

let realtimeChannel: any = null;
let lastCount = 0;
  let checkingAuth = true;
  let sidebarOpen = false;
  let sidebarCollapsed = false;

  const restaurantStore = writable<string | null>(null);
  setContext(RESTAURANT_CTX, restaurantStore);

  let authSubscription: any;

  onMount(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      goto("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("restaurant_id")
      .eq("id", session.user.id)
      .single();

    if (!profile?.restaurant_id) {
      goto("/dashboard/no-restaurant");
      return;
    }

    restaurantStore.set(profile.restaurant_id);
    // 🔁 Initial load of payment pending count
const { data: initialOrders } = await supabase
  .from('orders')
  .select('id')
  .eq('restaurant_id', profile.restaurant_id)
  .neq('payment_status', 'success');

lastCount = initialOrders?.length ?? 0;
paymentPendingCount.set(lastCount);

// 🔴 Realtime listener
realtimeChannel = supabase
  .channel('payment-pending-orders')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'orders',
      filter: `restaurant_id=eq.${profile.restaurant_id}`
    },
    async () => {
      const { data } = await supabase
        .from('orders')
        .select('id')
        .eq('restaurant_id', profile.restaurant_id)
        .neq('payment_status', 'success');

      const newCount = data?.length ?? 0;

      paymentPendingCount.set(newCount);

      // ✅ Trigger pulse ONLY when count increases
      if (newCount > lastCount) {
        triggerPaymentPulse();
      }

      lastCount = newCount;
    }
  )
  .subscribe();

    checkingAuth = false;

    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) goto("/login");
    });

    authSubscription = data.subscription;
  });

  onDestroy(() => {
  realtimeChannel && supabase.removeChannel(realtimeChannel);
});


  onDestroy(() => {
    authSubscription?.unsubscribe();
    if (browser) document.body.style.overflow = "";
  });

  $: if (browser) {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
  }

  /* 🔥 IMPORTANT FIX */
  function isActive(target: string) {
    const path = $page.url.pathname;

    if (target === "/dashboard") {
      return path === "/dashboard";
    }

    return path === target || path.startsWith(target + "/");
  }

  function navClass(target: string) {
    return `
      flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
      ${
        isActive(target)
          ? "bg-slate-900 text-white"
          : "text-slate-700 hover:bg-slate-100"
      }
    `;
  }
  $: currentPath = $page.url.pathname;

  $: pageTitle =
    currentPath === "/dashboard"
      ? "Dashboard"
      : currentPath.startsWith("/dashboard/orders/payment")
        ? "Payment Pending"
        : currentPath.startsWith("/dashboard/orders/active")
          ? "Active Orders"
          : currentPath.startsWith("/dashboard/orders/closed")
            ? "Closed Orders"
            : currentPath.startsWith("/dashboard/menu")
              ? "Menu"
              : currentPath.startsWith("/dashboard/settings")
                ? "Settings"
                : "";

  async function logout() {
    await supabase.auth.signOut();
    goto("/login");
  }
</script>

{#if checkingAuth}
  <div class="h-screen flex items-center justify-center bg-slate-100">
    <span class="text-sm text-slate-500">Checking session…</span>
  </div>
{:else}
  <div class="h-screen overflow-hidden bg-slate-100 flex">
    {#if sidebarOpen}
      <div
        class="fixed inset-0 bg-black/40 z-40 md:hidden"
        on:click={() => (sidebarOpen = false)}
      />
    {/if}

    <aside
      class={`
        fixed md:static z-50
        h-full bg-white border-r
        transition-all duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
        ${sidebarCollapsed ? "w-20" : "w-64"}
      `}
    >
      <div class="h-16 flex items-center justify-between px-4 border-b">
        {#if !sidebarCollapsed}
          <div>
            <div class="font-semibold">Kitchen</div>
            <div class="text-xs text-slate-500">Dashboard</div>
          </div>
        {/if}
        <button
          class="text-slate-600"
          on:click={() => (sidebarCollapsed = !sidebarCollapsed)}
        >
          ☰
        </button>
      </div>

      <nav class="px-3 py-4 space-y-1">
        <!-- HOME -->
        <a
          href="/dashboard"
          class="
      flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
      {$page.url.pathname === '/dashboard'
            ? 'bg-slate-900 text-white'
            : 'text-slate-700 hover:bg-slate-100'}
    "
        >
          🏠 {!sidebarCollapsed && "Home"}
        </a>

        <!-- SECTION LABEL -->
        {#if !sidebarCollapsed}
          <div
            class="px-3 mt-4 mb-1 text-[11px] font-semibold text-slate-400 uppercase"
          >
            Orders
          </div>
        {/if}

        <!-- PAYMENT -->
        <a
  href="/dashboard/orders/payment"
  class="
    flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium
    {$page.url.pathname.startsWith('/dashboard/orders/payment')
      ? 'bg-slate-900 text-white'
      : 'text-slate-700 hover:bg-slate-100'}
  "
>
  <div class="flex items-center gap-3">
    💰 {!sidebarCollapsed ? 'Payment Pending' : ''}
  </div>

  {#if !sidebarCollapsed && $paymentPendingCount > 0}
    <div class="relative">
      <!-- COUNT BADGE -->
      <span
        class="
          min-w-[20px] h-5 px-1
          rounded-full text-xs font-semibold
          flex items-center justify-center
          bg-red-600 text-white
        "
      >
        {$paymentPendingCount}
      </span>

      <!-- SOFT PULSE -->
      {#if $paymentPulse}
        <span
          class="
            absolute inset-0 rounded-full
            bg-red-400 opacity-40
            animate-ping
          "
        ></span>
      {/if}
    </div>
  {/if}
</a>


        <!-- ACTIVE -->
        <a
          href="/dashboard/orders/active"
          class="
      flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
      {$page.url.pathname.startsWith('/dashboard/orders/active')
            ? 'bg-slate-900 text-white'
            : 'text-slate-700 hover:bg-slate-100'}
    "
        >
          📋 {!sidebarCollapsed ? "Active Orders":''}
        </a>

        <!-- CLOSED -->
        <a
          href="/dashboard/orders/closed"
          class="
      flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
      {$page.url.pathname.startsWith('/dashboard/orders/closed')
            ? 'bg-slate-900 text-white'
            : 'text-slate-700 hover:bg-slate-100'}
    "
        >
          ✅ {!sidebarCollapsed ? "Closed Orders":''}
        </a>
        {#if !sidebarCollapsed}
          <div
            class="px-3 mt-4 mb-1 text-[11px] font-semibold text-slate-400 uppercase"
          >
            Orders
          </div>
        {/if}
        <a
          href="/dashboard/menu"
          class="
      flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
      {$page.url.pathname.startsWith('/dashboard/menu')
            ? 'bg-slate-900 text-white'
            : 'text-slate-700 hover:bg-slate-100'}
    "
        >
          🍽️ {!sidebarCollapsed ? "Menu":''}
        </a>
        <a
          href="/dashboard/settings"
          class="
      flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
      {$page.url.pathname.startsWith('/dashboard/settings')
            ? 'bg-slate-900 text-white'
            : 'text-slate-700 hover:bg-slate-100'}
    "
        >
          ⚙️ {!sidebarCollapsed ? "Settings":''}
        </a>
      </nav>

      <div class="absolute bottom-0 w-full p-3 border-t">
        <button
          class="w-full rounded-lg bg-slate-900 text-white py-2 text-sm"
          on:click={logout}
        >
          {!sidebarCollapsed ? "Logout" : "⏻"}
        </button>
      </div>
    </aside>

    <div class="flex-1 flex flex-col">
      <header class="h-16 bg-white border-b flex items-center px-4 gap-3">
        <button class="md:hidden text-xl" on:click={() => (sidebarOpen = true)}>
          ☰
        </button>
        <div class="text-sm font-medium text-slate-600">
          {pageTitle}
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-4 md:p-6">
        <slot />
      </main>
    </div>
  </div>
{/if}
