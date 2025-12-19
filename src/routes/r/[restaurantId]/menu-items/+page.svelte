<script lang="ts">
  import { onMount, tick } from "svelte";
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import { supabase } from "$lib/supabaseClient";

  import ItemModal from "$lib/components/ItemModal.svelte";
  import CategoryModal from "$lib/components/CategoryModal.svelte";

  const restaurantId = page.params.restaurantId as string;

  type Category = { id: string; name: string };
  type Item = {
    id: string;
    name: string;
    price: number;
    description: string | null;
    tags: string[];
    image_url: string | null;
    is_veg: boolean;
    available: boolean;
    category_id: string;
  };

  let categories: Category[] = [];
  let items: Item[] = [];
  let activeCategory: string | null = null;

  let showItemModal = false;
  let editingItem: Item | null = null;
  let showCategoryModal = false;

  let search = "";
  let debouncedSearch = "";
  let debounceTimer: ReturnType<typeof setTimeout>;

  // description state
  let expandedDesc = new Set<string>();
  let overflowingDesc = new Set<string>();

  function toggleDesc(id: string) {
    const next = new Set(expandedDesc);
    next.has(id) ? next.delete(id) : next.add(id);
    expandedDesc = next;
  }

  /* ---------- ACTION: detect overflow ---------- */
  function detectOverflow(node: HTMLElement, id: string) {
    const check = async () => {
      await tick();
      if (node.scrollHeight > node.clientHeight) {
        overflowingDesc = new Set(overflowingDesc).add(id);
      }
    };

    check();

    return {
      update() {
        check();
      }
    };
  }

  /* ---------- LOAD ---------- */
  async function loadAll() {
    const { data: cats } = await supabase
      .from("menu_categories")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .order("sort_order");

    categories = cats ?? [];
    activeCategory = null; // ✅ Default = All

    const { data: its } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order");

    items = its ?? [];
  }

  onMount(loadAll);

  /* ---------- SEARCH DEBOUNCE ---------- */
  $: {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedSearch = search;
    }, 150);
  }

  /* ---------- FILTER ---------- */
  $: filteredItems = items.filter((i) => {
    const byCategory =
      activeCategory === null ? true : i.category_id === activeCategory;

    const q = debouncedSearch.toLowerCase();
    const bySearch =
      i.name.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.tags?.join(" ").toLowerCase().includes(q);

    return byCategory && bySearch;
  });

  /* ---------- AVAILABILITY ---------- */
  async function toggleAvailability(item: Item) {
    const next = !item.available;

    items = items.map((i) =>
      i.id === item.id ? { ...i, available: next } : i
    );

    await supabase
      .from("menu_items")
      .update({ available: next })
      .eq("id", item.id);
  }

  /* ---------- SCROLL LOCK ---------- */
  $: if (browser) {
    document.body.style.overflow =
      showItemModal || showCategoryModal ? "hidden" : "";
  }
</script>

<!-- ================= LAYOUT ================= -->

<div class="max-w-6xl mx-auto p-3 sm:p-4">

  <!-- STICKY CONTROLS -->
  <div class="sticky top-0 z-30 bg-white space-y-4 pb-3">

    <!-- HEADER -->
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold">Menu</h1>

      <div class="flex gap-2">
        <button
          class="border px-3 py-2 rounded text-sm"
          on:click={() => (showCategoryModal = true)}
        >
          + Category
        </button>

        <button
          class="bg-black text-white px-3 py-2 rounded text-sm disabled:opacity-50"
          disabled={categories.length === 0}
          on:click={() => {
            editingItem = null;
            showItemModal = true;
          }}
        >
          + Item
        </button>
      </div>
    </div>

    <!-- SEARCH -->
    <input
      type="text"
      placeholder="Search item…"
      class="w-full border rounded px-4 py-3 text-base"
      bind:value={search}
    />

    <!-- CATEGORIES -->
    <div class="flex gap-2 overflow-x-auto pb-1">
      <button
        class="px-4 py-2 rounded-full text-sm
          {activeCategory === null ? 'bg-black text-white' : 'bg-gray-100'}"
        on:click={() => (activeCategory = null)}
      >
        All
      </button>

      {#each categories as c}
        <button
          class="px-4 py-2 rounded-full text-sm
            {c.id === activeCategory ? 'bg-black text-white' : 'bg-gray-100'}"
          on:click={() => (activeCategory = c.id)}
        >
          {c.name}
        </button>
      {/each}
    </div>
  </div>

  <!-- ITEMS -->
  <div class="mt-3 space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto overscroll-contain">
    {#if filteredItems.length === 0}
      <p class="text-sm text-gray-500 text-center mt-6">No items found</p>
    {/if}

    {#each filteredItems as item (item.id)}
      <div class="border rounded-xl p-3 bg-white flex gap-3 items-start">

        <!-- IMAGE -->
        {#if item.image_url}
          <img src={item.image_url} class="w-16 h-16 rounded-lg object-cover shrink-0" />
        {:else}
          <div class="w-16 h-16 rounded-lg bg-gray-100 shrink-0"></div>
        {/if}

        <!-- INFO -->
        <div
          class="flex-1 cursor-pointer"
          on:click={() => {
            editingItem = item;
            showItemModal = true;
          }}
        >
          <p class="font-medium text-sm leading-snug line-clamp-2">{item.name}</p>
          <p class="text-sm font-semibold mt-0.5">₹{item.price}</p>

          <!-- DESCRIPTION -->
          {#if item.description}
            <p
              use:detectOverflow={item.id}
              class="text-xs text-gray-600 mt-1
                {expandedDesc.has(item.id) ? '' : 'line-clamp-2'}"
            >
              {item.description}
            </p>

            {#if overflowingDesc.has(item.id)}
              <button
                class="mt-1 text-xs font-medium text-blue-600 underline cursor-pointer"
                on:click|stopPropagation={() => toggleDesc(item.id)}
              >
                {expandedDesc.has(item.id) ? "View less" : "View more"}
              </button>
            {/if}
          {/if}

          <!-- TAGS -->
          {#if item.tags?.length}
            <div class="flex gap-1 mt-1 flex-wrap">
              {#each item.tags.slice(0, 2) as t}
                <span class="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">
                  {t}
                </span>
              {/each}
              {#if item.tags.length > 2}
                <span class="text-[10px] text-gray-500">
                  +{item.tags.length - 2} more
                </span>
              {/if}
            </div>
          {/if}
        </div>

        <!-- AVAILABILITY -->
        <button
          class="px-3 py-1 rounded-full text-xs font-medium shrink-0
                 {item.available
                   ? 'bg-green-100 text-green-700'
                   : 'bg-gray-200 text-gray-600'}"
          on:click={() => toggleAvailability(item)}
        >
          {item.available ? "ON" : "OFF"}
        </button>
      </div>
    {/each}
  </div>
</div>

<!-- ================= MODALS ================= -->

{#if showItemModal}
  <ItemModal
    {restaurantId}
    categoryId={activeCategory ?? categories[0]?.id}
    item={editingItem}
    onClose={() => (showItemModal = false)}
    onSaved={loadAll}
  />
{/if}

{#if showCategoryModal}
  <CategoryModal
    {restaurantId}
    onClose={() => (showCategoryModal = false)}
    onSaved={loadAll}
  />
{/if}
