<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';

  export let restaurantId: string;
  export let categoryId: string;
  export let item: any | null;
  export let onClose: () => void;
  export let onSaved: () => void;

  type Category = { id: string; name: string };

  let categories: Category[] = [];

  let name = item?.name ?? '';
  let price = item?.price ?? 0;
  let description = item?.description ?? '';
  let tags = item?.tags?.join(', ') ?? '';
  let image_url = item?.image_url ?? '';
  let isVeg = item?.is_veg ?? true;
  let available = item?.available ?? true;

  let selectedCategoryId = item?.category_id ?? categoryId;
  let saving = false;

  onMount(async () => {
    const { data } = await supabase
      .from('menu_categories')
      .select('id, name')
      .eq('restaurant_id', restaurantId)
      .order('sort_order');

    categories = data ?? [];
  });

  async function save() {
    saving = true;

    const payload = {
      restaurant_id: restaurantId,
      category_id: selectedCategoryId,
      name: name.trim(),
      price,
      description: description.trim() || null,
      tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      image_url: image_url.trim() || null,
      is_veg: isVeg,
      available
    };

    if (item) {
      await supabase.from('menu_items').update(payload).eq('id', item.id);
    } else {
      await supabase.from('menu_items').insert(payload);
    }

    saving = false;
    onSaved();
    onClose();
  }
</script>

<!-- BACKDROP -->
<div class="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">

  <!-- MODAL -->
  <div
    class="bg-white w-full sm:max-w-md
           rounded-t-2xl sm:rounded-xl
           max-h-[90vh] flex flex-col"
  >
    <!-- HEADER -->
    <div class="p-4 border-b">
      <h2 class="font-semibold text-lg">
        {item ? 'Edit Item' : 'Add Item'}
      </h2>
    </div>

    <!-- BODY (SCROLLABLE) -->
    <div class="p-4 space-y-4 overflow-y-auto">

      <input
        class="w-full border rounded-lg px-4 py-3 text-base"
        placeholder="Item name"
        bind:value={name}
      />

      <input
        type="number"
        class="w-full border rounded-lg px-4 py-3 text-base"
        placeholder="Price"
        bind:value={price}
      />

      <select
        class="w-full border rounded-lg px-4 py-3 text-base"
        bind:value={selectedCategoryId}
      >
        {#each categories as c}
          <option value={c.id}>{c.name}</option>
        {/each}
      </select>

      <textarea
        class="w-full border rounded-lg px-4 py-3 text-base"
        rows="2"
        placeholder="Description (optional)"
        bind:value={description}
      />

      <input
        class="w-full border rounded-lg px-4 py-3 text-base"
        placeholder="Image URL"
        bind:value={image_url}
      />

      <input
        class="w-full border rounded-lg px-4 py-3 text-base"
        placeholder="Tags (spicy, chef special)"
        bind:value={tags}
      />

      <!-- VEG / NON-VEG -->
      <div class="flex gap-6">
        <label class="flex items-center gap-2 text-base">
          <input type="radio" bind:group={isVeg} value={true} />
          Veg
        </label>

        <label class="flex items-center gap-2 text-base">
          <input type="radio" bind:group={isVeg} value={false} />
          Non-veg
        </label>
      </div>

      <!-- AVAILABLE -->
      <label class="flex items-center gap-2 text-base">
        <input type="checkbox" bind:checked={available} />
        Available
      </label>
    </div>

    <!-- FOOTER -->
    <div class="p-4 border-t flex gap-3">
      <button
        class="flex-1 border rounded-lg py-3 text-base"
        on:click={onClose}
      >
        Cancel
      </button>

      <button
        class="flex-1 bg-black text-white rounded-lg py-3 text-base
               disabled:opacity-50"
        disabled={saving}
        on:click={save}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  </div>
</div>
