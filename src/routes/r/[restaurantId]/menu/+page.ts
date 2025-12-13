import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, url }) => {
  return {
    restaurantId: params.restaurantId,
    type: url.searchParams.get('type') ?? 'dine_in'
  };
};
