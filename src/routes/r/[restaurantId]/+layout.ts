// src/routes/r/[restaurantId]/+layout.ts
import type { LayoutLoad } from './$types';
import { supabase } from '$lib/supabaseClient';
import { isRestaurantOpen } from '$lib/utils/restaurantAvailability';

export const load: LayoutLoad = async ({ params }) => {
  const restaurantId = params.restaurantId;

  const { data } = await supabase
    .from('restaurants')
    .select(`
      id,
      name,
      logo_url,
      address,
      opening_time,
      closing_time,
      is_available,
      unavailable_message
    `)
    .eq('id', restaurantId)
    .maybeSingle();

  if (!data) {
    return {
      restaurant: null,
      availability: { available: false }
    };
  }

  const availability = isRestaurantOpen(data);

  return {
    restaurant: data,
    availability
  };
};
