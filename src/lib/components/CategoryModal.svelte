<script lang="ts">
  import { supabase } from '$lib/supabaseClient';

  export let restaurantId: string;
  export let onClose: () => void;
  export let onSaved: () => void;

  let name = '';
  let saving = false;

  async function save() {
    if (!name.trim()) return;
    saving = true;

    await supabase.from('menu_categories').insert({
      restaurant_id: restaurantId,
      name: name.trim()
    });

    saving = false;
    onSaved();
    onClose();
  }
</script>

<!-- BACKDROP -->
<div class="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
  <!-- MODAL -->
  <div
    class="bg-white w-full sm:max-w-sm
           rounded-t-2xl sm:rounded-xl
           p-4 sm:p-5
           safe-area-inset-bottom"
  >
    <!-- HEADER -->
    <h2 class="font-semibold text-lg mb-4">
      Add Category
    </h2>

    <!-- INPUT -->
    <input
      class="w-full border rounded-lg px-4 py-3 text-base mb-5"
      placeholder="Category name"
      bind:value={name}
      autofocus
    />

    <!-- ACTIONS -->
    <div class="flex gap-3">
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
