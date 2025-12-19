type Restaurant = {
  opening_time: string; // "09:00:00"
  closing_time: string; // "22:00:00"
  is_available: boolean;
};

export function isRestaurantOpen(
  restaurant: Restaurant
): {
  available: boolean;
  nextOpenTime?: string;
} {
  // Manual override always wins
  if (!restaurant.is_available) {
    return { available: false };
  }

  const now = new Date();

  const [openH, openM] = restaurant.opening_time.split(':').map(Number);
  const [closeH, closeM] = restaurant.closing_time.split(':').map(Number);

  const open = new Date(now);
  open.setHours(openH, openM, 0, 0);

  const close = new Date(now);
  close.setHours(closeH, closeM, 0, 0);

  // Handle overnight restaurants (e.g. 18:00 → 02:00)
  if (close <= open) {
    close.setDate(close.getDate() + 1);
  }

  const isOpen = now >= open && now <= close;
  if (isOpen) {
    return { available: true };
  }

  return {
    available: false,
    nextOpenTime: restaurant.opening_time,
  };
}
