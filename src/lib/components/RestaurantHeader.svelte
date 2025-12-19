<script lang="ts">
  export let restaurant;
</script>

<header class="fixed top-0 left-0 right-0 z-50 bg-white border-b">
  <div class="flex items-center gap-3 px-4 py-3">
    <img
      src={restaurant.logo_url ?? '/placeholder-logo.png'}
      alt="logo"
      class="w-10 h-10 rounded-full object-cover"
    />

    <div class="flex flex-col">
      <span class="font-semibold">{restaurant.name}</span>
      <span class="text-xs text-gray-500">
        {restaurant.address}
      </span>
    </div>
  </div>
</header>
