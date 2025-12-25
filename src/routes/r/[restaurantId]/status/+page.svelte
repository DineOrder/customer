<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { supabase } from "$lib/supabaseClient";
  import html2canvas from "html2canvas";

  /* ================= TYPES ================= */

  type OrderStatus = "pending" | "preparing" | "ready";

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
    order_type: "dine_in" | "takeaway";
    total_amount: number;
    created_at: string;
    payment_status: "success" | "pending" | "failed" | "cancelled";
    payment_mode: "counter" | "online";
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

  let statusFilter: "all" | OrderStatus = "all";

  let channel: ReturnType<typeof supabase.channel> | null = null;

  let showDownloadConfirm = false;
  let selectedOrder: Order | null = null;

  /* ================= HELPERS ================= */

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  function isWithinOneDay(iso: string): boolean {
    return Date.now() - new Date(iso).getTime() <= ONE_DAY_MS;
  }

  /* ---------- DISPLAY STATUS (FIXED) ---------- */

  function getDisplayStatus(order: Order): string {
    const { payment_mode, payment_status, status } = order;

    if (payment_status !== "success") {
      if (payment_mode === "counter" && payment_status === "pending") {
        return "Payment Pending";
      }
      if (payment_mode === "online" && payment_status === "pending") {
        return "Payment Processing";
      }
      if (payment_status === "failed") {
        return "Payment Failed";
      }
      if (payment_status === "cancelled") {
        return "Payment Cancelled";
      }
    }

    if (status === "pending") return "Order Placed";
    if (status === "preparing") return "Preparing";
    return "Ready";
  }

  function getStatusBadgeClass(order: Order): string {
    const { payment_status, payment_mode, status } = order;

    if (payment_status !== "success") {
      if (payment_status === "pending") {
        return payment_mode === "counter"
          ? "bg-orange-100 text-orange-700 border border-orange-200"
          : "bg-amber-100 text-amber-700 border border-amber-200";
      }

      if (payment_status === "failed") {
        return "bg-red-100 text-red-700 border border-red-200";
      }

      if (payment_status === "cancelled") {
        return "bg-slate-100 text-slate-600 border border-slate-200";
      }
    }

    if (status === "preparing") return "bg-yellow-100 text-yellow-700";
    if (status === "ready") return "bg-green-100 text-green-700";

    return "bg-blue-100 text-blue-700";
  }

  function getPaymentHint(order: Order): string | null {
    if (order.payment_status === "success") return null;

    if (order.payment_mode === "counter") {
      return "Please pay at counter to start preparation";
    }

    if (order.payment_status === "pending") {
      return "Waiting for payment confirmation";
    }

    if (order.payment_status === "failed") {
      return "Payment failed. Please retry";
    }

    if (order.payment_status === "cancelled") {
      return "Payment was cancelled";
    }

    return null;
  }

  function getSessionOrderIds(): string[] {
    return JSON.parse(
      localStorage.getItem(`qsr_orders_${restaurantId}`) ?? "[]",
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
      payment_status: o.payment_status,
      payment_mode: o.payment_mode,
      order_items: (o.order_items ?? []).map((i: any) => ({
        quantity: Number(i.quantity),
        price_per_item: Number(i.price_per_item),
        menu_items: i.menu_items ? { name: String(i.menu_items.name) } : null,
      })),
    }));
  }

  /* ================= LOADERS ================= */

  async function loadOrders(): Promise<void> {
    const ids = getSessionOrderIds();
    if (ids.length === 0) {
      orders = [];
      return;
    }

    const { data } = await supabase
      .from("orders")
      .select(
        `
        id,
        token_number,
        status,
        order_type,
        total_amount,
        created_at,
        payment_status,
        payment_mode,
        order_items (
          quantity,
          price_per_item,
          menu_items ( name )
        )
      `,
      )
      .in("id", ids)
      .order("created_at", { ascending: false });

    if (data) {
      const normalized = normalizeOrders(data);

      const recentOrders = normalized.filter((o) =>
        isWithinOneDay(o.created_at),
      );

      orders = recentOrders;

      localStorage.setItem(
        `qsr_orders_${restaurantId}`,
        JSON.stringify(recentOrders.map((o) => o.id)),
      );
    }
  }

  async function loadRestaurant(): Promise<void> {
    const { data } = await supabase
      .from("restaurants")
      .select("name")
      .eq("id", restaurantId)
      .single();

    restaurant = data as Restaurant;
  }

  /* ================= DERIVED ================= */

  $: filteredOrders =
    statusFilter === "all"
      ? orders
      : orders.filter((o) => o.status === statusFilter);

  /* ================= DOWNLOAD ================= */

  function requestDownload(order: Order) {
    selectedOrder = order;
    showDownloadConfirm = true;
  }

  async function confirmDownload() {
    if (!selectedOrder) return;

    const el = document.getElementById(`print-${selectedOrder.id}`);
    if (!el) return;

    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
    });

    const link = document.createElement("a");
    link.download = `token_${selectedOrder.token_number}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
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
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        async () => {
          await loadOrders();
        },
      )
      .subscribe();
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });

  function orderMore() {
    goto(`/r/${restaurantId}/menu`);
  }
</script>

<!-- ================= UI ================= -->

<div class="min-h-screen bg-neutral-100 px-4 py-6">
  {#if loading}
    <p class="text-center text-gray-500">Loading orders…</p>
  {:else}
    <div class="sticky top-0 z-20 bg-white border-b px-4 py-3 mb-6">
      <div class="max-w-md mx-auto flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-500">{restaurant?.name}</p>
          <h1 class="text-base font-semibold">Your Orders</h1>
        </div>

        <button
          class="px-4 py-2 rounded-lg text-sm bg-black text-white"
          on:click={orderMore}
        >
          + Order More
        </button>
      </div>
    </div>

    <div class="flex justify-center gap-3 mb-6">
      {#each ["all", "pending", "preparing", "ready"] as f}
        <button
          class={`px-4 py-2 rounded-lg text-sm border
        ${
          statusFilter === f ? "bg-black text-white" : "bg-white text-gray-700"
        }`}
          on:click={() => (statusFilter = f as any)}
        >
          {f === "all" ? "All Orders" : f}
        </button>
      {/each}
    </div>

    {#if filteredOrders.length > 0}
      <div class="space-y-4 max-w-md mx-auto">
        {#each filteredOrders as order (order.id)}
          <div
            tabindex="0"
            class="bg-white border rounded-lg p-4"
            on:click={() => requestDownload(order)}
          >
            <div class="flex justify-between mb-2">
              <div>
                <p class="text-xl font-semibold">#{order.token_number}</p>
                <p class="text-xs text-gray-500">
                  {order.order_type === "dine_in" ? "Dine In" : "Takeaway"}
                </p>
              </div>

              <span
                class={`
    inline-flex items-center gap-1.5
    px-3 py-1
    rounded-full
    text-xs font-semibold
    ${getStatusBadgeClass(order)}
  `}
              >
                {getDisplayStatus(order)}
              </span>
            </div>

            {#if getPaymentHint(order)}
              <div
                class="mb-3 rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-700"
              >
                {getPaymentHint(order)}
              </div>
            {/if}

            <div class="divide-y text-sm">
              {#each order.order_items as item}
                <div class="flex justify-between py-2">
                  <span
                    >{item.menu_items?.name ?? "Item"} × {item.quantity}</span
                  >
                  <span>₹{item.quantity * item.price_per_item}</span>
                </div>
              {/each}
            </div>

            <div class="flex justify-between pt-3 border-t mt-2 font-semibold">
              <span>Total</span>
              <span>₹{order.total_amount}</span>
            </div>

            <p class="mt-2 text-[11px] text-gray-400 text-center">
              Tap card to download bill
            </p>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-center text-gray-500 mt-8">No orders match this filter</p>
    {/if}

    <p class="mt-8 text-[11px] text-center text-gray-400">
      Orders older than 24 hours are automatically hidden. Local history may not
      reflect all orders.
    </p>
  {/if}
</div>
