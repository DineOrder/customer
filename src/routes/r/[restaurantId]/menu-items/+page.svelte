<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { supabase } from '$lib/supabaseClient';
  import EditMenuItemModal from '$lib/components/EditMenuItemModal.svelte';

  type MenuItem = {
    id: string;
    name: string;
    price: number;
    description: string | null;
    tags: string[];
    is_veg: boolean;
    available: boolean;
    category_name: string;
  };

  const restaurantId = page.params.restaurantId as string;

  let items: MenuItem[] = [];
  let loading = true;
  let search = '';
  let editingItemId: string | null = null;

  async function loadItems() {
    loading = true;

    const { data, error } = await supabase
      .from('menu_items')
      .select(`
        id,
        name,
        price,
        description,
        tags,
        is_veg,
        available,
        menu_categories (
          name
        )
      `)
      .eq('restaurant_id', restaurantId)
      .order('name');

    if (error) {
      console.error(error);
      loading = false;
      return;
    }

    items = (data ?? []).map((i: any) => ({
      id: i.id,
      name: i.name,
      price: Number(i.price),
      description: i.description,
      tags: Array.isArray(i.tags) ? i.tags : [],
      is_veg: i.is_veg,
      available: i.available,
      category_name: i.menu_categories?.name ?? 'Uncategorized'
    }));

    loading = false;
  }

  async function toggleAvailability(item: MenuItem) {
    const next = !item.available;

    await supabase
      .from('menu_items')
      .update({ available: next })
      .eq('id', item.id);

    loadItems();
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Delete this item?')) return;

    await supabase
      .from('menu_items')
      .delete()
      .eq('id', itemId);

    loadItems();
  }

  $: filtered =
    search.trim() === ''
      ? items
      : items.filter(i =>
          i.name.toLowerCase().includes(search.toLowerCase())
        );

  onMount(loadItems);
</script>

<div class="p-4 max-w-3xl mx-auto">
  <h1 class="text-xl font-semibold mb-4">Menu Items</h1>

  <input
    class="w-full mb-4 px-3 py-2 border rounded"
    placeholder="Search items…"
    bind:value={search}
  />

  {#if loading}
    <p>Loading…</p>
  {:else}
    <div class="space-y-2">
      {#each filtered as item (item.id)}
        <div class="border rounded p-3 flex gap-3 items-start bg-white">

          <!-- MAIN INFO -->
          <button
            type="button"
            class="flex-1 text-left cursor-pointer"
            on:click={() => (editingItemId = item.id)}
            aria-label={`Edit menu item: ${item.name}`}
          >
            <div class="flex items-center gap-2">
              <span class="font-medium">{item.name}</span>
              <span class="text-xs px-2 py-0.5 rounded
                {item.is_veg
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'}">
                {item.is_veg ? 'Veg' : 'Non-veg'}
              </span>
            </div>

            <div class="text-sm text-gray-600">
              ₹{item.price} · {item.category_name}
            </div>

            {#if item.description}
              <div class="text-xs text-gray-500 mt-1">
                {item.description}
              </div>
            {/if}

            {#if item.tags.length}
              <div class="text-xs text-gray-400 mt-1">
                #{item.tags.join(' #')}
              </div>
            {/if}
          </button>

          <!-- ACTIONS -->
          <div class="flex flex-col gap-2">
            <button
              class="px-3 py-1 text-sm rounded
                {item.available
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-300'}"
              on:click={() => toggleAvailability(item)}
            >
              {item.available ? 'Available' : 'Unavailable'}
            </button>

            <button
              class="px-3 py-1 text-sm rounded border"
              on:click={() => deleteItem(item.id)}
            >
              Delete
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if editingItemId}
  <EditMenuItemModal
    itemId={editingItemId}
    restaurantId={restaurantId}
    onClose={() => (editingItemId = null)}
    onSaved={loadItems}
  />
{/if}
