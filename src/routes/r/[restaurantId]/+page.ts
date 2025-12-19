// src/routes/r/[restaurantId]/+page.ts
import type { Load } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { MenuItem } from '$lib/types/menu';

export const load: Load = async ({ params, parent }) => {
  const { availability } = await parent();

  // 🚫 Restaurant closed → don't load menu
  if (!availability?.available) {
    return {
      menu: [] as MenuItem[]
    };
  }

  const restaurantId = params.restaurantId!;

  const { data, error } = await supabase
    .from('menu_items')
    .select(`
      id,
      restaurant_id,
      name,
      price,
      image_url,
      available,
      sort_order
    `)
    .eq('restaurant_id', restaurantId)
    .eq('available', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Menu load failed:', error);
    return {
      menu: [] as MenuItem[]
    };
  }

  return {
    menu: data as MenuItem[]
  };
};
