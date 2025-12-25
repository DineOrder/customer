<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { uploadMenuImage } from '$lib/utils/uploadMenuImage';

  export let open = false;
  export let item: any;              // original item
  export let restaurantId: string;   // passed from parent
  export let onClose: () => void;
  export let onSaved: (item: any) => void;

  let editedItem = { ...item };
  let saving = false;
  let uploading = false;

  /* ------------------ IMAGE UPLOAD ------------------ */
  async function handleImageUpload(e: Event) {
    if (!restaurantId || !editedItem?.id) return;

    const input = e.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    const file = input.files[0];

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }

    uploading = true;

    try {
      const url = await uploadMenuImage(
        file,
        restaurantId,
        editedItem.id
      );

      // ONLY update local edit state
      editedItem = {
        ...editedItem,
        image_url: url
      };
    } catch (err) {
      alert('Image upload failed');
    } finally {
      uploading = false;
    }
  }

  /* ------------------ SAVE ------------------ */
  async function save() {
    saving = true;

    const { error } = await supabase
      .from('menu_items')
      .update({
        name: editedItem.name,
        description: editedItem.description,
        price: editedItem.price,
        available: editedItem.available,
        image_url: editedItem.image_url
      })
      .eq('id', editedItem.id);

    saving = false;

    if (error) {
      alert('Failed to save');
      return;
    }

    onSaved(editedItem);
    onClose();
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
    <div class="bg-white rounded-xl w-full max-w-md p-5">
      <h2 class="text-lg font-semibold mb-4">
        Edit Item
      </h2>

      <!-- IMAGE PREVIEW -->
      <div class="mb-3">
        <img
          src={editedItem.image_url ?? '/placeholder-food.png'}
          alt="Preview"
          class="w-full h-40 object-cover rounded-lg border"
        />
      </div>

      <!-- IMAGE UPLOAD -->
      <label
        class="
          inline-flex items-center gap-2
          text-sm font-medium
          cursor-pointer
          text-slate-700
        "
      >
        📷 {uploading ? 'Uploading…' : 'Upload image'}
        <input
          type="file"
          accept="image/*"
          class="hidden"
          on:change={handleImageUpload}
          disabled={uploading}
        />
      </label>

      <p class="text-xs text-slate-500 mt-1 mb-4">
        JPG / PNG / WEBP · Max 2MB
      </p>

      <!-- NAME -->
      <input
        class="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
        bind:value={editedItem.name}
        placeholder="Item name"
      />

      <!-- DESCRIPTION -->
      <textarea
        class="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
        rows="3"
        bind:value={editedItem.description}
        placeholder="Description"
      />

      <!-- PRICE -->
      <input
        type="number"
        class="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
        bind:value={editedItem.price}
        placeholder="Price"
      />

      <!-- AVAILABILITY -->
      <label class="flex items-center gap-2 text-sm mb-4">
        <input type="checkbox" bind:checked={editedItem.available} />
        Available
      </label>

      <!-- ACTIONS -->
      <div class="flex justify-end gap-2">
        <button
          class="px-4 py-2 text-sm rounded-lg border"
          on:click={onClose}
        >
          Cancel
        </button>

        <button
          class="
            px-4 py-2 text-sm rounded-lg
            bg-slate-900 text-white
            disabled:opacity-60
          "
          on:click={save}
          disabled={saving || uploading}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}
