<script lang="ts">
  import { onMount } from 'svelte';
  import RestaurantHeader from '$lib/components/RestaurantHeader.svelte';
  import RestaurantUnavailable from '$lib/components/RestaurantUnavailable.svelte';
  import { isRestaurantOpen } from '$lib/utils/restaurantAvailability';

  export let data;

  const restaurant = data.restaurant;

  type Availability = ReturnType<typeof isRestaurantOpen>;

  let availability: Availability | null = null;
  let unavailableMessage: string | undefined;
  let nextOpenTime: string | undefined;
  let loading = true;

  onMount(() => {
    if (!restaurant) {
      unavailableMessage = "Restaurant not found";
      loading = false;
      return;
    }

    availability = isRestaurantOpen(restaurant);

    if (!availability.available) {
      if (!restaurant.is_available) {
        unavailableMessage =
          restaurant.unavailable_message ?? "Restaurant is temporarily unavailable";
      } else {
        unavailableMessage = "We're currently closed";
        nextOpenTime = availability.nextOpenTime;
      }
    }

    loading = false;
  });
</script>

{#if loading}
  <!-- Optional: skeleton / blank screen -->
  <div class="min-h-screen bg-white"></div>

{:else if !restaurant || !availability?.available}
  <RestaurantUnavailable
    restaurant={restaurant}
    message={unavailableMessage}
    nextOpenTime={nextOpenTime}
  />

{:else}
  <RestaurantHeader {restaurant} />
  <div class="pt-16">
    <slot />
  </div>
{/if}
