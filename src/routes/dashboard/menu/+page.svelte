<script lang="ts">
  import { onMount, onDestroy, getContext } from "svelte";
  import type { Writable } from "svelte/store";
  import { supabase } from "$lib/supabaseClient";
  import { RESTAURANT_CTX } from "$lib/context/restaurant";

  import ItemModal from "$lib/components/ItemModal.svelte";
  import CategoryModal from "$lib/components/CategoryModal.svelte";

  /* ------------------ Types ------------------ */
  type Category = {
    id: string;
    name: string;
    sort_order: number;
  };

  type MenuItem = {
    id: string;
    name: string;
    price: number;
    available: boolean;
    category_id: string;
    sort_order: number;
    description: string | null;
    image_url: string | null;
    tags: string[] | null;
  };

  /* ------------------ Context ------------------ */
  const restaurantStore = getContext<Writable<string | null>>(RESTAURANT_CTX);

  let restaurantId: string | null = null;
  const unsubscribeRestaurant = restaurantStore.subscribe((id) => {
    restaurantId = id;
  });

  onDestroy(() => {
    unsubscribeRestaurant();
  });

  /* ------------------ State ------------------ */
  let categories: Category[] = [];
  let items: MenuItem[] = [];

  let loading = true;
  let search = "";
  let showCategoryFilter = false;

  let activeCategory: string = "";

  let showItemModal = false;
  let showCategoryModal = false;
  let editingItem: MenuItem | null = null;

  async function toggleAvailability(item: MenuItem) {
    const newValue = !item.available;

    // Optimistic UI: replace item in array
    items = items.map((i) =>
      i.id === item.id ? { ...i, available: newValue } : i,
    );

    const { error } = await supabase
      .from("menu_items")
      .update({ available: newValue })
      .eq("id", item.id);

    if (error) {
      // rollback on failure
      items = items.map((i) =>
        i.id === item.id ? { ...i, available: !newValue } : i,
      );
      alert("Failed to update availability");
    }
  }

  

  /* ------------------ Load Data ------------------ */
  async function loadAll() {
    if (!restaurantId) return;

    loading = true;

    const [{ data: catData }, { data: itemData }] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("id, name, sort_order")
        .eq("restaurant_id", restaurantId)
        .order("sort_order"),

      supabase
        .from("menu_items")
        .select(
          `
  id,
  name,
  price,
  available,
  category_id,
  sort_order,
  description,
  image_url,
  tags
`,
        )
        .eq("restaurant_id", restaurantId)
        .order("sort_order"),
    ]);

    categories = (catData ?? []) as Category[];
    items = (itemData ?? []) as MenuItem[];

    loading = false;
  }

  onMount(loadAll);

  /* ------------------ Derived ------------------ */
  $: filteredItems = items.filter((item) => {
    const matchesCategory =
      !activeCategory || item.category_id === activeCategory;

    const matchesSearch = item.name
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  function categoryName(id: string): string {
    return categories.find((c) => c.id === id)?.name ?? "";
  }
</script>

<!-- ================= PAGE ================= -->
<div class="relative h-full flex flex-col">
  <div class="flex flex-col gap-6">
    <!-- HEADER -->
    <!-- FIXED HEADER + FILTER -->
    <div
      class="
    sticky top-0 z-20
    bg-slate-100
    pb-4
  "
    >
      <!-- HEADER -->
      <div
        class="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 class="text-xl font-semibold text-slate-900">Menu</h1>
          <p class="text-sm text-slate-500">Manage categories and items</p>
        </div>

        <!-- ACTIONS -->
        <div class="flex gap-2">
          <button
            class="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm"
            on:click={() => {
              editingItem = null;
              showItemModal = true;
            }}
          >
            + Item
          </button>

          <button
            class="rounded-lg border px-4 py-2 text-sm"
            on:click={() => (showCategoryModal = true)}
          >
            + Category
          </button>
        </div>
      </div>

      <!-- FILTER ROW -->
      <div class="mt-4 flex flex-col md:flex-row gap-3">
        <!-- SEARCH -->
        <input
          type="text"
          placeholder="Search item…"
          class="
        flex-1
        border rounded-lg
        px-4 py-2
        text-sm bg-white
      "
          bind:value={search}
        />

        <!-- CATEGORY DROPDOWN (DESKTOP) -->
        <div class="hidden md:block md:w-64">
          <div class="relative">
            <select
              class="
            w-full appearance-none
            border rounded-lg
            px-3 py-2 pr-8
            text-sm bg-white
          "
              bind:value={activeCategory}
            >
              <option value="">All categories</option>
              {#each categories as c}
                <option value={c.id}>{c.name}</option>
              {/each}
            </select>

            <span
              class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
            >
              ▼
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- CONTENT -->
    <div class="flex-1 overflow-y-auto pt-2">
      {#if loading}
        <p class="text-sm text-slate-500">Loading menu…</p>
      {:else if filteredItems.length === 0}
        <p class="text-sm text-slate-500">No items found</p>
      {:else}
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each filteredItems as item (item.id)}
            <div
              class="
    bg-white border rounded-xl p-4
    flex gap-4
    shadow-sm
  "
            >
              <!-- IMAGE -->
              <div
                class="w-20 h-20 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0"
              >
                {#if item.image_url}
                  <img
                    src={item.image_url}
                    alt={item.name}
                    class="w-full h-full object-cover"
                  />
                {:else}
                  <div
                    class="w-full h-full flex items-center justify-center text-slate-400 text-xs"
                  >
                    No image
                  </div>
                {/if}
              </div>

              <!-- INFO -->
              <div class="flex-1 flex flex-col gap-1">
                <div class="flex justify-between items-start">
                  <div>
                    <p class="font-medium leading-tight">{item.name}</p>
                    <p class="text-xs text-slate-500">₹{item.price}</p>
                  </div>

                  <button
                    class="text-sm text-slate-500 hover:text-slate-900"
                    on:click={() => {
                      editingItem = item;
                      showItemModal = true;
                    }}
                  >
                    ✏️
                  </button>
                </div>

                {#if item.description}
                  <p class="text-xs text-slate-600 line-clamp-2">
                    {item.description}
                  </p>
                {/if}

                <!-- TAGS -->
                {#if item.tags && item.tags.length > 0}
                  <div class="flex flex-wrap gap-1 mt-1">
                    {#each item.tags as tag}
                      <span
                        class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                      >
                        {tag}
                      </span>
                    {/each}
                  </div>
                {/if}

                <!-- FOOTER -->
                <div class="flex items-center justify-between mt-2">
                  <span
                    class="
    inline-flex items-center
    px-2 py-0.5
    rounded-full
    text-[11px] font-medium
    bg-indigo-50 text-indigo-700
    border border-indigo-100
  "
                  >
                    {categoryName(item.category_id)}
                  </span>

                  <!-- AVAILABILITY TOGGLE -->
                  <button
                    aria-label="toggleAvailibilty"
                    class="
          relative w-11 h-6 rounded-full transition
          {item.available ? 'bg-green-500' : 'bg-slate-300'}
        "
                    on:click={() => toggleAvailability(item)}
                  >
                    <span
                      class="
            absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white
            transition-transform
            {item.available ? 'translate-x-5' : ''}
          "
                    ></span>
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- CATEGORY FILTER BUTTON (MOBILE) -->
<button
  class="
    fixed bottom-6 right-6 z-40
    md:hidden
    w-14 h-14 rounded-full
    bg-slate-900 text-white
    flex items-center justify-center
    shadow-lg
    active:scale-95
  "
  aria-label="Filter categories"
  on:click={() => (showCategoryFilter = true)}
>
  📘
</button>

<!-- MODALS -->
{#if showItemModal && restaurantId}
  <ItemModal
    {restaurantId}
    categoryId={activeCategory || categories[0]?.id}
    item={editingItem}
    onClose={() => (showItemModal = false)}
    onSaved={loadAll}
  />
{/if}

{#if showCategoryModal && restaurantId}
  <CategoryModal
    {restaurantId}
    onClose={() => (showCategoryModal = false)}
    onSaved={loadAll}
  />
{/if}

{#if showCategoryFilter}
  <!-- BACKDROP -->
  <button
    aria-label="Close category filter"
    class="fixed inset-0 bg-black/40 z-40 md:hidden"
    on:click={() => (showCategoryFilter = false)}
  ></button>

  <!-- BOTTOM SHEET -->
  <div
    class="
      fixed bottom-0 left-0 right-0 z-50
      bg-white rounded-t-2xl
      p-4
      md:hidden
      max-h-[70vh] overflow-y-auto
    "
  >
    <!-- HEADER -->
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-slate-900">Filter by category</h3>
      <button
        class="text-slate-500 text-sm"
        on:click={() => (showCategoryFilter = false)}
      >
        Close
      </button>
    </div>

    <!-- CATEGORY LIST -->
    <div class="flex flex-col gap-2">
      <!-- ALL -->
      <button
        class="
          text-left px-3 py-2 rounded-lg text-sm
          {activeCategory === ''
          ? 'bg-slate-900 text-white'
          : 'hover:bg-slate-100'}
        "
        on:click={() => {
          activeCategory = "";
          showCategoryFilter = false;
        }}
      >
        All categories
      </button>

      {#each categories as c}
        <button
          class="
            text-left px-3 py-2 rounded-lg text-sm
            {activeCategory === c.id
            ? 'bg-slate-900 text-white'
            : 'hover:bg-slate-100'}
          "
          on:click={() => {
            activeCategory = c.id;
            showCategoryFilter = false;
          }}
        >
          {c.name}
        </button>
      {/each}
    </div>
  </div>
{/if}
