<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';

  /* ================= PROPS ================= */

  export let itemId: string;
  export let restaurantId: string;
  export let onClose: () => void;
  export let onSaved: () => void;

  /* ================= TYPES ================= */

  type Category = { id: string; name: string };

  type MenuItem = {
    name: string;
    price: number;
    description: string;
    tags: string[];
    is_veg: boolean;
    available: boolean;
    category_id: string;
  };

  /* ================= STATE ================= */

  let item: MenuItem = {
    name: '',
    price: 0,
    description: '',
    tags: [],
    is_veg: true,
    available: true,
    category_id: ''
  };

  let categories: Category[] = [];
  let loading = true;
  let saving = false;

  /* ================= LOAD ================= */

  async function load() {
    loading = true;

    const { data, error } = await supabase
      .from('menu_items')
      .select(`
        name,
        price,
        description,
        tags,
        is_veg,
        available,
        category_id
      `)
      .eq('id', itemId)
      .single();

    if (error || !data) {
      console.error('Failed to load menu item', error);
      loading = false;
      return;
    }

    const { data: cats, error: catError } = await supabase
      .from('menu_categories')
      .select('id, name')
      .eq('restaurant_id', restaurantId)
      .order('name');

    if (catError) {
      console.error('Failed to load categories', catError);
    }

    item = {
      name: data.name,
      price: Number(data.price),
      description: data.description ?? '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      is_veg: data.is_veg,
      available: data.available,
      category_id: data.category_id
    };

    categories = cats ?? [];
    loading = false;
  }

  /* ================= SAVE ================= */

  async function save() {
    saving = true;

    const { error } = await supabase
      .from('menu_items')
      .update({
        name: item.name.trim(),
        price: item.price,
        description: item.description.trim() || null,
        tags: item.tags,
        is_veg: item.is_veg,
        available: item.available,
        category_id: item.category_id
      })
      .eq('id', itemId)
      .eq('restaurant_id', restaurantId); // ✅ important for RLS

    saving = false;

    if (error) {
      console.error('Failed to save item', error);
      return;
    }

    onSaved();
    onClose();
  }

  onMount(load);
</script>

<!-- ================= MODAL ================= -->

<div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
  <div class="bg-white w-full max-w-md rounded-lg p-4">

    {#if loading}
      <p class="text-center text-gray-500">Loading…</p>
    {:else}
      <h2 class="text-lg font-semibold mb-4">Edit Item</h2>

      <div class="space-y-3">

        <input
          class="w-full border p-2 rounded"
          placeholder="Item name"
          bind:value={item.name}
        />

        <input
          type="number"
          class="w-full border p-2 rounded"
          placeholder="Price"
          bind:value={item.price}
        />

        <textarea
          class="w-full border p-2 rounded"
          rows="3"
          placeholder="Description"
          bind:value={item.description}
        ></textarea>

        <input
          class="w-full border p-2 rounded"
          placeholder="Tags (comma separated)"
          value={item.tags.join(', ')}
          on:input={(e) =>
            item.tags = e.currentTarget.value
              .split(',')
              .map(t => t.trim())
              .filter(Boolean)
          }
        />

        <select class="w-full border p-2 rounded" bind:value={item.category_id}>
          {#each categories as c}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>

        <div class="flex gap-4">
          <label class="flex items-center gap-2">
            <input type="radio" bind:group={item.is_veg} value={true} />
            Veg
          </label>
          <label class="flex items-center gap-2">
            <input type="radio" bind:group={item.is_veg} value={false} />
            Non-veg
          </label>
        </div>

        <label class="flex gap-2 items-center">
          <input type="checkbox" bind:checked={item.available} />
          Available
        </label>

        <div class="flex gap-2 pt-2">
          <button class="flex-1 border rounded py-2" on:click={onClose}>
            Cancel
          </button>
          <button
            class="flex-1 bg-black text-white rounded py-2 disabled:opacity-50"
            on:click={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
