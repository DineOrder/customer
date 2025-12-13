<script lang="ts">
  import { supabase } from '$lib/supabaseClient';

  let restaurants = [];

  async function load() {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*');

    console.log("data:", data);
    console.log("error:", error);
    restaurants = data;
  }

  load();
</script>

<h1 class="text-xl font-bold">Supabase Connection Test</h1>

{#if restaurants.length > 0}
  <ul>
    {#each restaurants as r}
      <li>{r.name}</li>
    {/each}
  </ul>
{:else}
  <p>No restaurants found</p>
{/if}
