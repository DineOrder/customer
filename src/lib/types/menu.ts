export type MenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  price: number;
  description: string | null;
  tags: string[];
  is_veg: boolean;
  image_url: string | null;
  category_name: string | null;
  available: boolean;
  sort_order: number;
};
