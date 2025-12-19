<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores"; // ✅ IMPORTANT
  import { supabase } from "$lib/supabaseClient";
  import { cart } from "$lib/stores/cart";

  import type { MenuItem } from "$lib/types/menu";
  import type { CartState } from "$lib/types/cart";

  /* ------------------ Types ------------------ */
  type OrderType = "dine_in" | "takeaway";

  function parseOrderType(v: string | null): OrderType {
    return v === "takeaway" ? "takeaway" : "dine_in";
  }

  /* ------------------ Route / Reactive ------------------ */
  $: restaurantId = $page.params.restaurantId as string;
  $: orderType = parseOrderType($page.url.searchParams.get("type"));
  $: cartState = $cart as CartState | null;

  /* ------------------ State ------------------ */
  let items: MenuItem[] = [];
  let loading = true;

  let search = "";
  let activeCategory = "ALL";
  let expandedDescriptions = new Set<string>();

  /* ------------------ Order Type Switch ------------------ */
  function switchOrderType(type: OrderType) {
    if (type === orderType) return;

    // Clear cart to avoid mixing order types
    cart.clearCart();

    // URL is the source of truth
    goto(`/r/${restaurantId}/menu?type=${type}`, {
      replaceState: true
    });
  }

  /* ------------------ Helpers ------------------ */
  function toggleDescription(id: string) {
    const next = new Set(expandedDescriptions);
    next.has(id) ? next.delete(id) : next.add(id);
    expandedDescriptions = next;
  }

  function groupByCategory(list: MenuItem[]) {
    const map = new Map<string, MenuItem[]>();
    for (const item of list) {
      const key = item.category_name ?? "Others";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }

  /* ------------------ Local Orders ------------------ */
  function getLocalOrderIds(): string[] {
    const key = `qsr_orders_${restaurantId}`;
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  }

  $: localOrderIds = getLocalOrderIds();
  $: activeOrdersCount = localOrderIds.length;
  $: latestOrderId = localOrderIds[0];

  /* ------------------ Derived ------------------ */
  $: categories = [
    "ALL",
    ...Array.from(new Set(items.map(i => i.category_name ?? "Others")))
  ];

  $: filteredItems = items.filter(item => {
    const matchesCategory =
      activeCategory === "ALL" || item.category_name === activeCategory;

    const q = search.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(q) ||
      (item.description ?? "").toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  // ✅ Re-initialize cart whenever order type changes
$: if (
  restaurantId &&
  orderType &&
  (!$cart || $cart.restaurantId !== restaurantId || $cart.orderType !== orderType)
) {
  cart.initCart(restaurantId, orderType);
}



  $: grouped = groupByCategory(filteredItems);

  /* ------------------ Load ------------------ */
  onMount(async () => {
    // cart.initCart(restaurantId, orderType);

    const { data, error } = await supabase
      .from("public_menu_items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("available", true)
      .order("category_order")
      .order("sort_order");

    if (error) {
      console.error(error);
      return;
    }

    items = data ?? [];
    loading = false;
  });

  /* ------------------ Cart ------------------ */
  function add(item: MenuItem) {
    cart.addItem({
      itemId: item.id,
      name: item.name,
      price: item.price
    });
  }

  function inc(id: string) {
    const it = cartState?.items.find(i => i.itemId === id);
    if (it) cart.updateQuantity(id, it.quantity + 1);
  }

  function dec(id: string) {
    const it = cartState?.items.find(i => i.itemId === id);
    if (it) cart.updateQuantity(id, it.quantity - 1);
  }

  function goToCart() {
    goto(`/r/${restaurantId}/cart`);
  }

  $: totalItems =
    cartState?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

  $: totalAmount =
    cartState?.items.reduce((s, i) => s + i.quantity * i.price, 0) ?? 0;
</script>

<!-- ================= UI ================= -->

<div class="min-h-screen px-4 py-6 pb-32">
  <h1 class="text-xl font-semibold mb-2">
    {orderType === "dine_in" ? "Dine In" : "Takeaway"} Menu
  </h1>

  <!-- ORDER TYPE SWITCH (UX-CLEAR) -->
  <div class="flex gap-2 mb-4">
    <button
      class="flex-1 py-2 rounded-lg border text-sm font-medium transition
        {orderType === 'dine_in'
          ? 'bg-black text-white border-black'
          : 'bg-white text-gray-700'}"
      on:click={() => switchOrderType("dine_in")}
    >
      Dine In
    </button>

    <button
      class="flex-1 py-2 rounded-lg border text-sm font-medium transition
        {orderType === 'takeaway'
          ? 'bg-black text-white border-black'
          : 'bg-white text-gray-700'}"
      on:click={() => switchOrderType("takeaway")}
    >
      Takeaway
    </button>
  </div>

  <!-- VIEW ORDERS -->
  {#if activeOrdersCount > 0}
    <button
      class="mb-4 w-full flex items-center justify-center gap-2
             border rounded-lg py-2 text-sm font-medium bg-white shadow-sm"
      on:click={() => goto(`/r/${restaurantId}/status`)}
    >
      📦 View Orders
      <span class="text-xs bg-black text-white px-2 py-0.5 rounded-full">
        {activeOrdersCount}
      </span>
    </button>
  {/if}

  <!-- SEARCH -->
  <input
    class="w-full mb-4 px-3 py-2 border rounded"
    placeholder="Search items…"
    bind:value={search}
  />

  {#if loading}
    <p class="text-sm text-gray-500">Loading menu…</p>
  {:else}
    {#each grouped as [category, items]}
      <section class="mb-8">
        <h2 class="text-lg font-semibold mb-3">{category}</h2>

        <ul class="space-y-4">
          {#each items as item (item.id)}
            <li class="flex gap-4 border rounded-lg p-4 bg-white">
              {#if item.image_url}
                <img
                  src={item.image_url}
                  alt={item.name}
                  class="w-20 h-20 rounded-lg object-cover"
                  loading="lazy"
                />
              {:else}
                <div
                  class="w-20 h-20 rounded-lg bg-gray-100
                         flex items-center justify-center
                         text-xs text-gray-400"
                >
                  No image
                </div>
              {/if}

              <div class="flex-1">
                <p class="font-medium">{item.name}</p>
                <p class="text-sm text-gray-600">₹{item.price}</p>

                {#if item.description}
                  <p
                    class="text-xs text-gray-500 mt-1
                      {expandedDescriptions.has(item.id)
                        ? ''
                        : 'line-clamp-2'}"
                  >
                    {item.description}
                  </p>

                  {#if item.description.length > 80}
                    <button
                      class="text-xs text-blue-600 mt-1"
                      on:click={() => toggleDescription(item.id)}
                    >
                      {expandedDescriptions.has(item.id)
                        ? "View less"
                        : "View more"}
                    </button>
                  {/if}
                {/if}
              </div>

              <div class="flex items-center">
                {#if cartState?.items.find(i => i.itemId === item.id)}
                  <div class="flex items-center gap-2">
                    <button class="w-8 h-8 border" on:click={() => dec(item.id)}>
                      −
                    </button>
                    <span>
                      {cartState.items.find(i => i.itemId === item.id)?.quantity}
                    </span>
                    <button
                      class="w-8 h-8 bg-black text-white"
                      on:click={() => inc(item.id)}
                    >
                      +
                    </button>
                  </div>
                {:else}
                  <button
                    class="px-3 py-2 bg-black text-white rounded"
                    on:click={() => add(item)}
                  >
                    Add
                  </button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</div>

<!-- CART BAR -->
<div
  class="fixed bottom-0 left-0 right-0 px-4 py-3 flex justify-between items-center
    {totalItems > 0 ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}"
>
  <div>
    {#if totalItems > 0}
      <p class="text-sm">{totalItems} item(s)</p>
      <p class="font-medium">₹{totalAmount}</p>
    {:else}
      <p class="text-sm">Your cart is empty</p>
    {/if}
  </div>

  <button
    class="px-4 py-2 rounded bg-white text-black"
    disabled={totalItems === 0}
    on:click={goToCart}
  >
    View Cart
  </button>
</div>
