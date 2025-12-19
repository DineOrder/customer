<script lang="ts">
  import RestaurantHeader from '$lib/components/RestaurantHeader.svelte';
  import closed from '$lib/assets/closed.png';

  type Restaurant = {
    id: string;
    name: string;
    logo_url?: string;
    address?: string;
  };

  type Props = {
    restaurant?: Restaurant | null;
    message?: string;
    nextOpenTime?: string;
  };

  let { restaurant, message, nextOpenTime }: Props = $props();
</script>

{#if restaurant}
  <RestaurantHeader {restaurant} />
{/if}

<div
  class="min-h-screen flex flex-col items-center justify-center text-center px-6 gap-4 pt-20"
>
  <img
    src={closed}
    alt="Restaurant closed"
    class="w-48 opacity-80"
  />

  <h2 class="text-xl font-semibold">
    {message ?? "We're currently closed"}
  </h2>

  {#if nextOpenTime}
    <p class="text-sm text-gray-500">
      We’ll be back at {nextOpenTime}
    </p>
  {/if}
</div>
